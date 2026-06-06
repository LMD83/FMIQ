/**
 * VerifIQ — discipline review agent.
 *
 * One agent per discipline. Loads the layered system prompt (master + discipline
 * + self-check), calls the Phase 1 LLM adapter under the
 * "discipline-primary-review" role, parses §05.1 findings, runs each candidate
 * through the 7-check self-check gate, and emits only those that pass — logging
 * every self-check decision to the audit sink.
 *
 * Scope (docs/28 Phase 2): agents only. The orchestrator, peer challenge and
 * adjudication are Phase 3+.
 * Version: 0.4.0-phase2
 */

import type { LLMClient } from "../llm/index.js";
import type { Finding, Stage } from "../types/index.js";
import { PromptLoader } from "./prompts.js";
import { parseFindings } from "./parse.js";
import { runSelfCheck, type SelfCheckAuditEntry } from "./self-check.js";
import { STAGE_CODE, type DisciplineDef } from "./disciplines.js";

/** A document made available to the agent. */
export interface ReviewDocument {
  filename: string;
  text: string;
}

export interface ReviewInput {
  projectStage: Stage;
  documents: ReviewDocument[];
  /** Free-text project/intake context (planning grant, exclusions, etc.). */
  projectContext?: string;
  /** Issue signatures already addressed (self-check Check 4). */
  alreadyAddressed?: string[];
  corpusVersion?: string;
}

export interface ReviewResult {
  /** Findings that passed the self-check gate (with provenance set). */
  findings: Finding[];
  /** Every self-check decision (emitted / suppressed / downgraded). */
  audits: SelfCheckAuditEntry[];
  /** Candidates that failed JSON/shape validation. */
  invalid: { raw: unknown; reason: string }[];
}

/** Audit sink — records each self-check decision (e.g. to audit_log). */
export type SelfCheckSink = (entry: SelfCheckAuditEntry) => Promise<void> | void;

export interface AgentDeps {
  llm: LLMClient;
  prompts: PromptLoader;
  audit?: SelfCheckSink;
}

export class DisciplineAgent {
  constructor(
    private readonly def: DisciplineDef,
    private readonly deps: AgentDeps,
  ) {}

  get displayName(): string {
    return this.def.displayName;
  }

  /** Assemble the layered system prompt from the canonical prompt files. */
  private async systemPrompt(): Promise<string> {
    const [master, selfCheck, ...sections] = await Promise.all([
      this.deps.prompts.master(),
      this.deps.prompts.selfCheck(),
      ...this.def.sections.map((s) => this.deps.prompts.disciplineSection(s)),
    ]);
    return [
      master,
      "\n\n# Your discipline\n\n",
      sections.join("\n\n"),
      "\n\n# Self-check protocol (apply before emitting any finding)\n\n",
      selfCheck,
      "\n\n",
      OUTPUT_INSTRUCTION,
    ].join("");
  }

  /** Review the supplied documents and return self-checked findings. */
  async review(input: ReviewInput): Promise<ReviewResult> {
    const system = await this.systemPrompt();
    const userMessage = buildUserMessage(this.def.displayName, input);

    const result = await this.deps.llm.complete("discipline-primary-review", userMessage, {
      system,
      agentId: this.def.agentId,
      promptVersion: this.def.promptVersion,
      corpusVersion: input.corpusVersion,
    });

    const { findings: candidates, invalid } = parseFindings(result.text);
    const sourceText = input.documents.map((d) => d.text).join("\n\n");
    const stageCode = STAGE_CODE[input.projectStage] ?? "DES";

    const emitted: Finding[] = [];
    const audits: SelfCheckAuditEntry[] = [];
    let seq = 1;

    for (const candidate of candidates) {
      // Assign a stable issue_id + discipline origin where the model omitted them.
      if (!candidate.issue_id) {
        candidate.issue_id = `${this.def.issuePrefix}-${stageCode}-${String(seq).padStart(4, "0")}`;
      }
      if (!candidate.discipline_origin) candidate.discipline_origin = this.def.displayName;
      seq++;

      const { finding, audit } = runSelfCheck(this.def.agentId, candidate, {
        disciplineMatch: this.def.matchTokens,
        model: result.model_used,
        sourceText,
        alreadyAddressed: input.alreadyAddressed,
      });
      audits.push(audit);
      if (this.deps.audit) await this.deps.audit(audit);

      if (finding) emitted.push(finding);
    }

    return { findings: emitted, audits, invalid };
  }
}

/** Build a discipline agent for one of the MVP disciplines. */
export function createDisciplineAgent(def: DisciplineDef, deps: AgentDeps): DisciplineAgent {
  return new DisciplineAgent(def, deps);
}

// ── helpers ──────────────────────────────────────────────────────────────────

/**
 * Code-level output wiring (not a domain prompt): instruct the model to return
 * findings as a strict JSON array matching §05.1, each with a verbatim source
 * quote. Phrased in permitted vocabulary (file 08).
 */
const OUTPUT_INSTRUCTION = [
  "# Output format",
  "",
  "Return ONLY a JSON array of finding objects (no prose, no code fence).",
  "Each object MUST use these keys and the allowed values:",
  "- issue_id, discipline_origin, interface_disciplines (array)",
  '- stage: "design" | "pre-tender" | "pre-build" | "construction" | "handover"',
  "- project_area, location, source_document, source_reference, related_documents (array)",
  "- requirement, finding",
  '- status: "Compliant" | "Non-compliant" | "Not demonstrated" | "Clarification required" | "Coordination issue" | "Construction evidence required" | "Handover evidence required" | "Outside current scope"',
  '- risk: "Critical" | "High" | "Medium" | "Low" | "Advisory"',
  '- build_readiness_impact: "Build blocker" | "Proceed with condition" | "Pre-tender close-out" | "Pre-construction close-out" | "Construction hold point" | "Handover requirement" | "Advisory"',
  "- question, required_evidence (array), owner, secondary_owner, close_out_stage",
  "",
  "source_reference MUST be a verbatim quote from the named source_document.",
  "Set discipline_origin to your own discipline. If you cannot quote the source, omit the finding.",
].join("\n");

function buildUserMessage(discipline: string, input: ReviewInput): string {
  const parts = [
    `You are reviewing as the ${discipline} discipline. Project stage: ${input.projectStage}.`,
  ];
  if (input.projectContext) parts.push(`\nProject context:\n${input.projectContext}`);
  parts.push("\nDocuments under review:");
  for (const doc of input.documents) {
    parts.push(`\n--- ${doc.filename} ---\n${doc.text}`);
  }
  return parts.join("\n");
}
