/**
 * VerifIQ — Peer Challenge agent (Stage 5).
 *
 * Challenges a set of findings from another discipline's perspective, per
 * verifiq-prompts/07_council_prompts.md § 07.1. Uses the "peer-challenge" LLM
 * role (a different model family from the primary review — file 02, avoids
 * shared blind spots). Returns one ChallengeRecord per finding it has a view on;
 * parsing is defensive so a malformed model reply degrades to "no challenge"
 * rather than breaking the pipeline.
 *
 * Scope (Phase 3): an engine the orchestrator calls; it does not persist.
 * Version: 0.5.0-phase3
 */

import type { LLMClient } from "../llm/index.js";
import type { CouncilDecision, Finding, Risk } from "../types/index.js";
import { PromptLoader } from "./prompts.js";

const COUNCIL_DECISIONS: readonly CouncilDecision[] = [
  "Retained",
  "Amended",
  "Merged",
  "Downgraded",
  "Escalated",
  "Deleted",
];
const RISKS: readonly Risk[] = ["Critical", "High", "Medium", "Low", "Advisory"];

/** One peer-challenge verdict on a single finding. */
export interface ChallengeRecord {
  issue_id: string;
  challenger_discipline: string;
  decision: CouncilDecision;
  reason: string;
  revised_risk?: Risk;
  interface_discipline?: string;
  required_action?: string;
  model_used: string;
}

export interface ChallengeAuditEntry {
  action: "peer_challenge";
  issue_id: string;
  challenger_discipline: string;
  decision: CouncilDecision;
  revised_risk: Risk | null;
  model: string;
  timestamp: string;
}

export type ChallengeSink = (entry: ChallengeAuditEntry) => Promise<void> | void;

export interface ChallengeInput {
  /** Findings to challenge (already excludes the challenger's own findings). */
  findings: Finding[];
  /** Display name of the challenging discipline. */
  challengerDiscipline: string;
  corpusVersion?: string;
}

export interface ChallengeDeps {
  llm: LLMClient;
  prompts: PromptLoader;
  audit?: ChallengeSink;
}

export class PeerChallengeAgent {
  constructor(private readonly deps: ChallengeDeps) {}

  private async systemPrompt(): Promise<string> {
    const [master, challenge] = await Promise.all([
      this.deps.prompts.master(),
      this.deps.prompts.councilSection("07.1"),
    ]);
    return `${master}\n\n# Peer Challenge role\n\n${challenge}\n\n${OUTPUT_INSTRUCTION}`;
  }

  /** Challenge the supplied findings; returns one record per finding addressed. */
  async challenge(input: ChallengeInput): Promise<ChallengeRecord[]> {
    if (input.findings.length === 0) return [];

    let text: string;
    let model = "unknown";
    try {
      const system = await this.systemPrompt();
      const res = await this.deps.llm.complete("peer-challenge", buildMessage(input), {
        system,
        agentId: `peer-challenge:${input.challengerDiscipline}`,
        corpusVersion: input.corpusVersion,
      });
      text = res.text;
      model = res.model_used;
    } catch {
      // Provider chain exhausted — no challenge from this discipline (the
      // orchestrator continues; the finding simply isn't peer-reviewed here).
      return [];
    }

    const records: ChallengeRecord[] = [];
    for (const raw of parseArray(text)) {
      const rec = toRecord(raw, input.challengerDiscipline, model);
      if (!rec) continue;
      records.push(rec);
      if (this.deps.audit) {
        await this.deps.audit({
          action: "peer_challenge",
          issue_id: rec.issue_id,
          challenger_discipline: rec.challenger_discipline,
          decision: rec.decision,
          revised_risk: rec.revised_risk ?? null,
          model,
          timestamp: new Date().toISOString(),
        });
      }
    }
    return records;
  }
}

export function createPeerChallengeAgent(deps: ChallengeDeps): PeerChallengeAgent {
  return new PeerChallengeAgent(deps);
}

// ── helpers ──────────────────────────────────────────────────────────────────

const OUTPUT_INSTRUCTION = [
  "# Output format",
  "",
  "Return ONLY a JSON array (no prose, no code fence). One object per finding you",
  "have a view on, with keys:",
  "- issue_id (string, must match a supplied finding)",
  '- decision: "Retained" | "Amended" | "Merged" | "Downgraded" | "Escalated" | "Deleted"',
  "- reason (string)",
  '- revised_risk (optional): "Critical" | "High" | "Medium" | "Low" | "Advisory"',
  "- interface_discipline (optional string)",
  "- required_action (optional string)",
  "Omit findings you do not need to challenge.",
].join("\n");

function buildMessage(input: ChallengeInput): string {
  return [
    `Challenge the following findings from the ${input.challengerDiscipline} perspective.`,
    "For each, decide whether it should be retained, amended, merged, downgraded, escalated or deleted, and why.",
    "",
    "Findings (JSON):",
    JSON.stringify(input.findings, null, 2),
  ].join("\n");
}

function parseArray(text: string): unknown[] {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1]!.trim();
  if (!t.startsWith("[")) {
    const arr = t.match(/\[[\s\S]*\]/);
    if (arr) t = arr[0];
  }
  try {
    const parsed = JSON.parse(t);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function toRecord(raw: unknown, challenger: string, model: string): ChallengeRecord | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const issue_id = typeof o.issue_id === "string" ? o.issue_id : "";
  if (!issue_id) return null;
  const decision = COUNCIL_DECISIONS.includes(o.decision as CouncilDecision)
    ? (o.decision as CouncilDecision)
    : "Retained";
  const revised_risk = RISKS.includes(o.revised_risk as Risk)
    ? (o.revised_risk as Risk)
    : undefined;
  return {
    issue_id,
    challenger_discipline: challenger,
    decision,
    reason: typeof o.reason === "string" ? o.reason : "",
    ...(revised_risk ? { revised_risk } : {}),
    ...(typeof o.interface_discipline === "string"
      ? { interface_discipline: o.interface_discipline }
      : {}),
    ...(typeof o.required_action === "string" ? { required_action: o.required_action } : {}),
    model_used: model,
  };
}
