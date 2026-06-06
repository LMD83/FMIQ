/**
 * VerifIQ — Council Chair agent.
 *
 * Consolidates a set of (adjudicated) findings into one §05.3 Build Readiness
 * Report. The build-readiness rating and the executive decision are derived
 * deterministically from the findings per verifiq-prompts/06_risk_rules.md and
 * the rating↔decision mapping is enforced in code (file 06: "enforced at code
 * level"). The LLM (council-chair role) supplies only the narrative prose.
 *
 * The report always carries the locked disclaimer (file 08).
 *
 * Scope (docs/28 Phase 2): the Chair is an agent, not an orchestrator. Wiring
 * findings → adjudication → chair into a pipeline is Phase 3.
 * Version: 0.4.0-phase2
 */

import type { LLMClient } from "../llm/index.js";
import type {
  BuildReadinessRating,
  BuildReadinessReport,
  ExecutiveDecision,
  Finding,
} from "../types/index.js";
import { LOCKED_DISCLAIMER } from "../constants.js";
import { PromptLoader } from "./prompts.js";

/** file 06 mapping table — the enforced invariant. */
const RATING_TO_DECISION: Record<BuildReadinessRating, ExecutiveDecision> = {
  Green: "Proceed",
  Amber: "Proceed with conditions",
  Red: "Pause before build",
  Grey: "Insufficient information",
};

/** Statuses that count as "resolved" for rating purposes. */
const RESOLVED = new Set(["Compliant", "Outside current scope"]);

export interface ChairInput {
  projectName: string;
  projectStage: string;
  buildingType: string;
  reviewDate: string;
  modulesActivated: string[];
  disciplinesReviewed: string[];
  findings: Finding[];
  /** True when core documents are missing so readiness can't be determined. */
  coreDocumentsMissing?: boolean;
  corpusVersion?: string;
  reviewerInitials?: string;
}

export interface ChairDeps {
  llm: LLMClient;
  prompts: PromptLoader;
}

/** Derive rating + decision from findings (file 06 rules). */
export function deriveDecision(
  findings: Finding[],
  coreDocumentsMissing = false,
): { rating: BuildReadinessRating; decision: ExecutiveDecision } {
  let rating: BuildReadinessRating;
  if (coreDocumentsMissing) {
    rating = "Grey";
  } else {
    const unresolved = findings.filter((f) => !RESOLVED.has(f.status));
    const hasCritical = unresolved.some((f) => f.risk === "Critical");
    const hasHigh = unresolved.some((f) => f.risk === "High");
    rating = hasCritical ? "Red" : hasHigh ? "Amber" : "Green";
  }
  return { rating, decision: RATING_TO_DECISION[rating] };
}

export class ChairAgent {
  constructor(private readonly deps: ChairDeps) {}

  private async systemPrompt(): Promise<string> {
    const [master, chair] = await Promise.all([
      this.deps.prompts.master(),
      this.deps.prompts.councilSection("07.3"),
    ]);
    return `${master}\n\n# Council Chair role\n\n${chair}`;
  }

  /** Produce the Build Readiness Report. */
  async report(input: ChairInput): Promise<BuildReadinessReport> {
    const { rating, decision } = deriveDecision(input.findings, input.coreDocumentsMissing);

    // Narrative from the LLM; structured decision stays code-derived.
    let councilSummary = "";
    let finalRecommendation = "";
    try {
      const system = await this.systemPrompt();
      const user = buildChairMessage(input, rating, decision);
      const res = await this.deps.llm.complete("council-chair", user, {
        system,
        agentId: "council-chair",
        corpusVersion: input.corpusVersion,
      });
      const narrative = parseNarrative(res.text);
      councilSummary = narrative.council_summary;
      finalRecommendation = narrative.final_recommendation;
    } catch {
      // Fallback narrative if the model output isn't usable — the structured
      // decision is unaffected (it is derived in code).
    }
    if (!councilSummary) councilSummary = fallbackSummary(input.findings, rating);
    if (!finalRecommendation) finalRecommendation = `${decision}.`;

    const byImpact = (impact: string) =>
      input.findings.filter((f) => f.build_readiness_impact === impact).map((f) => f.issue_id);
    const byRisk = (risk: string) =>
      input.findings.filter((f) => f.risk === risk).map((f) => f.issue_id);

    return {
      project_name: input.projectName,
      project_stage: input.projectStage,
      building_type: input.buildingType,
      review_date: input.reviewDate,
      regulatory_modules_activated: input.modulesActivated,
      disciplines_reviewed: input.disciplinesReviewed,
      build_readiness_rating: rating,
      executive_decision: decision,
      council_summary: councilSummary,
      critical_blockers: input.findings
        .filter((f) => f.risk === "Critical" && !RESOLVED.has(f.status))
        .map((f) => f.issue_id),
      high_risk_conditions: byRisk("High"),
      discipline_action_matrix: input.findings.map((f) => f.issue_id),
      interface_risk_matrix: input.findings
        .filter((f) => f.interface_disciplines.length > 0)
        .map((f) => f.issue_id),
      statutory_approval_risks: input.findings
        .filter((f) => f.build_readiness_impact === "Build blocker")
        .map((f) => f.issue_id),
      planning_condition_risks: input.findings
        .filter((f) => /planning/i.test(f.requirement) || /planning/i.test(f.finding))
        .map((f) => f.issue_id),
      tender_cost_risks: byImpact("Pre-tender close-out"),
      construction_hold_points: byImpact("Construction hold point"),
      handover_evidence_requirements: byImpact("Handover requirement"),
      final_recommendation: finalRecommendation,
      disclaimer: LOCKED_DISCLAIMER,
    };
  }
}

export function createChairAgent(deps: ChairDeps): ChairAgent {
  return new ChairAgent(deps);
}

// ── helpers ──────────────────────────────────────────────────────────────────

function buildChairMessage(
  input: ChairInput,
  rating: BuildReadinessRating,
  decision: ExecutiveDecision,
): string {
  return [
    `Project: ${input.projectName} (${input.buildingType}), stage ${input.projectStage}.`,
    `The code-derived build readiness rating is ${rating} and the executive decision is "${decision}".`,
    "Do not change the decision; write the narrative around it.",
    "",
    "Adjudicated findings (JSON):",
    JSON.stringify(input.findings, null, 2),
    "",
    'Return ONLY JSON: {"council_summary": "2-3 short paragraphs", "final_recommendation": "one paragraph ending with the executive decision"}.',
  ].join("\n");
}

function parseNarrative(text: string): { council_summary: string; final_recommendation: string } {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1]!.trim();
  const obj = JSON.parse(t) as { council_summary?: unknown; final_recommendation?: unknown };
  return {
    council_summary: typeof obj.council_summary === "string" ? obj.council_summary : "",
    final_recommendation:
      typeof obj.final_recommendation === "string" ? obj.final_recommendation : "",
  };
}

function fallbackSummary(findings: Finding[], rating: BuildReadinessRating): string {
  const critical = findings.filter((f) => f.risk === "Critical" && !RESOLVED.has(f.status)).length;
  const high = findings.filter((f) => f.risk === "High" && !RESOLVED.has(f.status)).length;
  return (
    `Council position: ${rating}. The review surfaced ${findings.length} finding(s), ` +
    `including ${critical} unresolved Critical and ${high} unresolved High item(s). ` +
    `See the action surface below for the items the design team should read closely.`
  );
}
