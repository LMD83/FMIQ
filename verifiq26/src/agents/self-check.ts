/**
 * VerifIQ — agent self-check protocol (the 7 pre-emit checks).
 *
 * Every candidate finding passes through this gate before an agent emits it.
 * Implements the 7 mandatory checks from `verifiq-prompts/13_agent_self_check_protocol.md`
 * and produces the audit entry shape that file 13 specifies (the primary
 * training signal for the lessons-learnt loop, file 15).
 *
 * Mechanically-enforceable checks (source quote present, discipline ownership,
 * consequence, required evidence, named owner) hard-fail → suppress. Stage
 * appropriateness soft-fails → downgrade. The richer judgement checks (verbatim
 * verification against source text, project-context overrides) run when the
 * caller supplies the relevant context.
 *
 * Version: 0.4.0-phase2
 */

import type { Finding, Risk } from "../types/index.js";

export const CHECK_LABELS = [
  "1-source",
  "2-discipline",
  "3-stage",
  "4-context",
  "5-consequence",
  "6-evidence",
  "7-owner",
] as const;
export type CheckLabel = (typeof CHECK_LABELS)[number];

export type SelfCheckOutcome = "emitted" | "suppressed" | "downgraded";
export type EvidenceType = "Documented" | "Cross-referenced" | "Pattern-recognised";

/** The audit entry written on every self-check run (file 13). */
export interface SelfCheckAuditEntry {
  agent: string;
  candidate_finding_id: string;
  checks_passed: CheckLabel[];
  checks_failed: CheckLabel[];
  outcome: SelfCheckOutcome;
  downgraded_from: string | null;
  neg_pattern_triggered: string | null;
  evidence_type: EvidenceType | null;
  model: string;
  timestamp: string;
}

export interface SelfCheckContext {
  /**
   * Lower-case tokens the candidate's `discipline_origin` may contain for the
   * finding to be in this agent's lane (Check 2). e.g. ["architect"], or
   * ["mechanical", "electrical", "m&e"] for the combined M&E agent.
   */
  disciplineMatch: string[];
  /** Model id that produced the candidate (for the audit entry). */
  model: string;
  /** Optional verbatim source text; enables strict Check 1 verification. */
  sourceText?: string;
  /** Issue signatures already addressed elsewhere (Check 4 / NEG-05). */
  alreadyAddressed?: string[];
}

export interface SelfCheckResult {
  /** The finding to emit (possibly adjusted by a downgrade), or null if suppressed. */
  finding: Finding | null;
  audit: SelfCheckAuditEntry;
}

/** Owners too generic to be actionable (Check 7 / NEG library). */
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

function nonEmpty(s: string | undefined | null): boolean {
  return typeof s === "string" && s.trim().length > 0;
}

/**
 * Run the 7 checks against a candidate finding. Returns the (possibly adjusted)
 * finding to emit, or null when suppressed, plus the audit entry.
 */
export function runSelfCheck(
  agent: string,
  candidate: Finding,
  ctx: SelfCheckContext,
): SelfCheckResult {
  const passed: CheckLabel[] = [];
  const failed: CheckLabel[] = [];
  let neg: string | null = null;
  let downgradedFrom: string | null = null;
  let finding: Finding = { ...candidate };

  // Check 1 — source quote present (and verbatim if source text supplied).
  let check1 = nonEmpty(candidate.source_document) && nonEmpty(candidate.source_reference);
  if (check1 && ctx.sourceText) {
    const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
    if (!normalize(ctx.sourceText).includes(normalize(candidate.source_reference))) {
      check1 = false;
      neg = "NEG-09"; // finding without verbatim citation
    }
  }
  pushCheck(check1, "1-source", passed, failed);

  // Check 2 — discipline ownership.
  const origin = candidate.discipline_origin.toLowerCase();
  const check2 = nonEmpty(candidate.discipline_origin) && ctx.disciplineMatch.some((t) => origin.includes(t));
  pushCheck(check2, "2-discipline", passed, failed);
  if (!check2 && neg === null) neg = "NEG-03"; // cross-discipline finger-pointing

  // Check 3 — stage appropriateness (soft: downgrade Build blocker on future evidence).
  let check3 = true;
  if (
    candidate.status === "Construction evidence required" &&
    candidate.build_readiness_impact === "Build blocker"
  ) {
    finding.build_readiness_impact = "Construction hold point";
    downgradedFrom = "Build blocker → Construction hold point";
    check3 = false;
    neg = neg ?? "NEG-04";
  } else if (
    candidate.status === "Handover evidence required" &&
    candidate.build_readiness_impact === "Build blocker"
  ) {
    finding.build_readiness_impact = "Handover requirement";
    downgradedFrom = "Build blocker → Handover requirement";
    check3 = false;
    neg = neg ?? "NEG-04";
  }
  pushCheck(check3, "3-stage", passed, failed);

  // Check 4 — project-context override (suppress duplicates already addressed).
  const signature = `${candidate.issue_id}|${candidate.requirement}`.toLowerCase();
  const check4 = !(ctx.alreadyAddressed ?? []).some((a) => signature.includes(a.toLowerCase()));
  pushCheck(check4, "4-context", passed, failed);
  if (!check4) neg = "NEG-05"; // duplicate of an already-noted finding

  // Check 5 — consequence statement (material finding text + an impact).
  const check5 = candidate.finding.trim().length >= 20 && nonEmpty(candidate.build_readiness_impact);
  pushCheck(check5, "5-consequence", passed, failed);

  // Check 6 — required-evidence statement.
  const check6 = candidate.required_evidence.some((e) => nonEmpty(e));
  pushCheck(check6, "6-evidence", passed, failed);

  // Check 7 — named owner.
  const check7 = nonEmpty(candidate.owner) && !GENERIC_OWNERS.has(candidate.owner.trim().toLowerCase());
  pushCheck(check7, "7-owner", passed, failed);

  // Outcome. Hard checks (1,2,4,5,6,7) suppress; Check 3 alone downgrades.
  const hardFail = !check1 || !check2 || !check4 || !check5 || !check6 || !check7;
  let outcome: SelfCheckOutcome;
  if (hardFail) {
    outcome = "suppressed";
    finding = candidate;
  } else if (!check3) {
    outcome = "downgraded";
  } else {
    outcome = "emitted";
  }

  const evidenceType: EvidenceType =
    candidate.related_documents.length > 0 || candidate.interface_disciplines.length > 0
      ? "Cross-referenced"
      : "Documented";

  return {
    finding: outcome === "suppressed" ? null : finding,
    audit: {
      agent,
      candidate_finding_id: candidate.issue_id || "CANDIDATE",
      checks_passed: passed,
      checks_failed: failed,
      outcome,
      downgraded_from: downgradedFrom,
      neg_pattern_triggered: hardFail || outcome === "downgraded" ? neg : null,
      evidence_type: outcome === "suppressed" ? null : evidenceType,
      model: ctx.model,
      timestamp: new Date().toISOString(),
    },
  };
}

function pushCheck(ok: boolean, label: CheckLabel, passed: CheckLabel[], failed: CheckLabel[]): void {
  (ok ? passed : failed).push(label);
}

/** Re-export for callers building risk-aware logic. */
export type { Risk };
