/**
 * VerifIQ — Adjudicator agent (Stage 6).
 *
 * Produces the accepted issue register from the discipline findings + peer
 * challenges, per verifiq-prompts/07_council_prompts.md § 07.2 and the rules in
 * verifiq-prompts/06_risk_rules.md. Decisions are CODE-DETERMINISTIC (delete
 * no-owner / no-consequence / out-of-scope / unsourced; merge duplicates; apply
 * agreed escalations/downgrades; triple-jeopardy → Critical) so the register is
 * reproducible and the file-06 invariants hold regardless of model variance.
 * The "adjudicator" LLM role is consulted best-effort for a council rationale
 * note only; it never drives deletion or the rating.
 *
 * Every decision is recorded with pre/post state for the audit trail (file 06).
 *
 * Scope (Phase 3): an engine the orchestrator calls; it does not persist.
 * Version: 0.5.0-phase3
 */

import type { LLMClient } from "../llm/index.js";
import type { CouncilDecision, Finding, FindingStatus, Risk } from "../types/index.js";
import { PromptLoader } from "./prompts.js";
import type { ChallengeRecord } from "./challenge.js";

const RISK_ORDER: Record<Risk, number> = {
  Advisory: 0,
  Low: 1,
  Medium: 2,
  High: 3,
  Critical: 4,
};

const GENERIC_OWNERS = new Set([
  "",
  "the design team",
  "design team",
  "team",
  "various",
  "tbc",
  "tbd",
  "n/a",
  "na",
]);

/** Snapshot used for the file-06 audit trail (pre/post). */
export interface AdjudicationState {
  risk: Risk;
  status: FindingStatus;
  owner: string;
}

export interface AdjudicationRecord {
  issue_id: string;
  council_decision: CouncilDecision;
  rationale: string;
  pre: AdjudicationState;
  post: AdjudicationState;
  adjudicator_model: string;
}

export interface AdjudicateInput {
  findings: Finding[];
  challenges: ChallengeRecord[];
  corpusVersion?: string;
}

export interface AdjudicateResult {
  /** The accepted register: retained / amended / downgraded / escalated findings. */
  adjudicated: Finding[];
  /** One record per input finding (including deleted / merged). */
  decisions: AdjudicationRecord[];
}

export type AdjudicationSink = (record: AdjudicationRecord) => Promise<void> | void;

export interface AdjudicatorDeps {
  llm?: LLMClient;
  prompts?: PromptLoader;
  audit?: AdjudicationSink;
}

export class AdjudicatorAgent {
  constructor(private readonly deps: AdjudicatorDeps = {}) {}

  /** Adjudicate findings against their peer challenges (file 06 rules). */
  async adjudicate(input: AdjudicateInput): Promise<AdjudicateResult> {
    const model = await this.rationaleModel(input);
    const byIssue = groupChallenges(input.challenges);

    const seenKeys = new Map<string, string>(); // dedupe key → kept issue_id
    const adjudicated: Finding[] = [];
    const decisions: AdjudicationRecord[] = [];

    for (const original of input.findings) {
      const pre: AdjudicationState = {
        risk: original.risk,
        status: original.status,
        owner: original.owner,
      };
      const challenges = byIssue.get(original.issue_id) ?? [];
      const finding: Finding = {
        ...original,
        interface_disciplines: [...original.interface_disciplines],
      };

      let decision: CouncilDecision = "Retained";
      const reasons: string[] = [];

      // DELETE rules (file 06 § Adjudicator DELETE).
      if (isOwnerless(finding.owner)) {
        decision = "Deleted";
        reasons.push("no actionable owner");
      } else if (finding.status === "Outside current scope") {
        decision = "Deleted";
        reasons.push("outside project scope");
      } else if (finding.finding.trim().length < 20) {
        decision = "Deleted";
        reasons.push("no stated consequence");
      } else if (!finding.source_reference.trim()) {
        decision = "Deleted";
        reasons.push("speculative — no source anchor");
      }

      // MERGE duplicates (same requirement + source reference).
      if (decision !== "Deleted") {
        const key = dedupeKey(finding);
        const keptBy = seenKeys.get(key);
        if (keptBy) {
          decision = "Merged";
          reasons.push(`duplicate of ${keptBy}`);
        } else {
          seenKeys.set(key, finding.issue_id);
        }
      }

      // Apply peer challenges (escalate / downgrade / delete) + interface merge.
      if (decision === "Retained") {
        for (const ch of challenges) {
          if (
            ch.interface_discipline &&
            !finding.interface_disciplines.includes(ch.interface_discipline)
          ) {
            finding.interface_disciplines.push(ch.interface_discipline);
          }
          if (ch.decision === "Deleted") {
            decision = "Deleted";
            reasons.push(`peer (${ch.challenger_discipline}): ${ch.reason || "challenged out"}`);
            break;
          }
          if (
            ch.decision === "Escalated" &&
            ch.revised_risk &&
            RISK_ORDER[ch.revised_risk] > RISK_ORDER[finding.risk]
          ) {
            finding.risk = ch.revised_risk;
            decision = "Escalated";
            reasons.push(`peer (${ch.challenger_discipline}) escalated to ${ch.revised_risk}`);
          } else if (
            ch.decision === "Downgraded" &&
            ch.revised_risk &&
            RISK_ORDER[ch.revised_risk] < RISK_ORDER[finding.risk]
          ) {
            finding.risk = ch.revised_risk;
            decision = "Downgraded";
            reasons.push(`peer (${ch.challenger_discipline}) downgraded to ${ch.revised_risk}`);
          }
        }
      }

      // ESCALATE override (file 06 § triple-jeopardy): fire + access + life-safety.
      if (decision !== "Deleted" && decision !== "Merged" && isTripleJeopardy(finding)) {
        if (finding.risk !== "Critical") {
          finding.risk = "Critical";
          if (decision === "Retained") decision = "Escalated";
          reasons.push("triple-jeopardy (fire + accessibility + life-safety) → Critical");
        }
      }

      const rationale = reasons.length
        ? reasons.join("; ")
        : "Evidence-supported; retained as flagged.";
      finding.council_decision = decision;
      if (decision !== "Retained") finding.rationale = rationale;

      const record: AdjudicationRecord = {
        issue_id: finding.issue_id,
        council_decision: decision,
        rationale,
        pre,
        post: { risk: finding.risk, status: finding.status, owner: finding.owner },
        adjudicator_model: model,
      };
      decisions.push(record);
      if (this.deps.audit) await this.deps.audit(record);

      if (decision !== "Deleted" && decision !== "Merged") adjudicated.push(finding);
    }

    return { adjudicated, decisions };
  }

  /** Best-effort: confirm the adjudicator model id via the LLM role; else code. */
  private async rationaleModel(input: AdjudicateInput): Promise<string> {
    if (!this.deps.llm || !this.deps.prompts) return "code-rules";
    try {
      const [master, adj] = await Promise.all([
        this.deps.prompts.master(),
        this.deps.prompts.councilSection("07.2"),
      ]);
      const res = await this.deps.llm.complete(
        "adjudicator",
        "Acknowledge the adjudication ruleset for this register; reply with 'ack'.",
        {
          system: `${master}\n\n# Adjudicator role\n\n${adj}`,
          agentId: "adjudicator",
          corpusVersion: input.corpusVersion,
        },
      );
      return res.model_used;
    } catch {
      return "code-rules";
    }
  }
}

export function createAdjudicatorAgent(deps: AdjudicatorDeps = {}): AdjudicatorAgent {
  return new AdjudicatorAgent(deps);
}

// ── helpers ──────────────────────────────────────────────────────────────────

function groupChallenges(challenges: ChallengeRecord[]): Map<string, ChallengeRecord[]> {
  const map = new Map<string, ChallengeRecord[]>();
  for (const ch of challenges) {
    const list = map.get(ch.issue_id) ?? [];
    list.push(ch);
    map.set(ch.issue_id, list);
  }
  return map;
}

function isOwnerless(owner: string): boolean {
  return GENERIC_OWNERS.has(owner.trim().toLowerCase());
}

function dedupeKey(f: Finding): string {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  return `${norm(f.requirement)}|${norm(f.source_reference)}`;
}

/** Triple-jeopardy: the finding touches fire AND accessibility AND life-safety. */
function isTripleJeopardy(f: Finding): boolean {
  const hay =
    `${f.discipline_origin} ${f.interface_disciplines.join(" ")} ${f.requirement} ${f.finding}`.toLowerCase();
  const fire = /fire/.test(hay);
  const access = /(access|accessib|dac|part m)/.test(hay);
  const life = /(life.?safety|escape|evacuat|means of escape)/.test(hay);
  return fire && access && life;
}
