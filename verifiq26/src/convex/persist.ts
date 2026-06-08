/**
 * VerifIQ — orchestrator persistence Convex functions (Phase 4).
 *
 * The durable side of the orchestrator's PersistencePort (the in-process side is
 * `src/orchestrator/convex-persistence.ts`). Bulk read/write of findings,
 * challenges, adjudications and the report, plus the resumable `workflow_state`.
 * Bulk payloads use `v.any()` and are mapped to the exact table shape in the
 * handler so the schema validators still apply on insert.
 *
 * Audit writes are mutations (file 20 §2). Verify against a real deployment —
 * these are not exercised by the in-sandbox tests.
 *
 * SECURITY: every function here is `internal*` — callable only from the trusted
 * orchestrator runner action, never from a browser client. Public versions would
 * be an IDOR: anyone with a `project_id` could tamper with adjudications,
 * workflow state, or the report, or exfiltrate findings (the compliance register
 * is a trust-critical artefact). Authenticated project-membership checks belong
 * in the public action layer once Clerk auth lands.
 *
 * Version: 0.7.0-phase4
 */

import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { ScanState } from "./schema";
import { LOCKED_DISCLAIMER } from "../constants.js";

// ── workflow_state ────────────────────────────────────────────────────────────

export const getWorkflowState = internalQuery({
  args: { project_id: v.id("projects") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("workflow_state")
      .withIndex("by_project", (q) => q.eq("project_id", args.project_id))
      .unique();
  },
});

export const upsertWorkflowState = internalMutation({
  args: {
    project_id: v.id("projects"),
    scan_state: ScanState,
    completed_stages: v.array(v.string()),
    discipline_status: v.array(
      v.object({
        discipline: v.string(),
        status: v.union(v.literal("succeeded"), v.literal("failed")),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("workflow_state")
      .withIndex("by_project", (q) => q.eq("project_id", args.project_id))
      .unique();
    const fields = {
      project_id: args.project_id,
      scan_state: args.scan_state,
      completed_stages: args.completed_stages,
      discipline_status: args.discipline_status,
      updated_at: Date.now(),
    };
    if (existing) {
      await ctx.db.patch(existing._id, fields);
      return existing._id;
    }
    return ctx.db.insert("workflow_state", fields);
  },
});

// ── findings ──────────────────────────────────────────────────────────────────

interface FindingInput {
  issue_id: string;
  discipline_origin: string;
  interface_disciplines?: string[];
  stage: Doc<"findings">["stage"];
  project_area?: string;
  location?: string;
  source_document: string;
  source_reference: string;
  related_documents?: string[];
  requirement: string;
  finding: string;
  status: Doc<"findings">["status"];
  risk: Doc<"findings">["risk"];
  build_readiness_impact: Doc<"findings">["build_readiness_impact"];
  question?: string;
  required_evidence?: string[];
  owner: string;
  secondary_owner?: string;
  close_out_stage?: string;
  council_decision?: Doc<"findings">["council_decision"];
  rationale?: string;
  model_used?: string;
  prompt_version?: string;
  corpus_version?: string;
}

function toFindingRow(project_id: Doc<"findings">["project_id"], f: FindingInput, now: number) {
  return {
    project_id,
    issue_id: f.issue_id,
    discipline_origin: f.discipline_origin,
    interface_disciplines: f.interface_disciplines ?? [],
    stage: f.stage,
    ...(f.project_area !== undefined ? { project_area: f.project_area } : {}),
    ...(f.location !== undefined ? { location: f.location } : {}),
    source_document: f.source_document,
    source_reference: f.source_reference,
    related_documents: f.related_documents ?? [],
    requirement: f.requirement,
    finding: f.finding,
    status: f.status,
    risk: f.risk,
    build_readiness_impact: f.build_readiness_impact,
    ...(f.question !== undefined ? { question: f.question } : {}),
    required_evidence: f.required_evidence ?? [],
    owner: f.owner,
    ...(f.secondary_owner !== undefined ? { secondary_owner: f.secondary_owner } : {}),
    ...(f.close_out_stage !== undefined ? { close_out_stage: f.close_out_stage } : {}),
    ...(f.council_decision !== undefined ? { council_decision: f.council_decision } : {}),
    ...(f.rationale !== undefined ? { rationale: f.rationale } : {}),
    ...(f.model_used !== undefined ? { model_used: f.model_used } : {}),
    ...(f.prompt_version !== undefined ? { prompt_version: f.prompt_version } : {}),
    ...(f.corpus_version !== undefined ? { corpus_version: f.corpus_version } : {}),
    created_at: now,
    updated_at: now,
  };
}

/** Strip Convex housekeeping fields → the orchestrator's Finding shape. */
function fromFindingRow(doc: Doc<"findings">): FindingInput {
  const { _id, _creationTime, project_id, created_at, updated_at, self_check_audit_entry_id, ...rest } =
    doc;
  void _id;
  void _creationTime;
  void project_id;
  void created_at;
  void updated_at;
  void self_check_audit_entry_id;
  return rest;
}

export const insertFindings = internalMutation({
  args: { project_id: v.id("projects"), findings: v.array(v.any()) },
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const f of args.findings as FindingInput[]) {
      await ctx.db.insert("findings", toFindingRow(args.project_id, f, now));
    }
  },
});

export const listFindings = internalQuery({
  args: { project_id: v.id("projects") },
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("findings")
      .withIndex("by_project", (q) => q.eq("project_id", args.project_id))
      .collect();
    return docs.map(fromFindingRow);
  },
});

/** The adjudicated register: findings not deleted/merged. */
export const listAdjudicated = internalQuery({
  args: { project_id: v.id("projects") },
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("findings")
      .withIndex("by_project", (q) => q.eq("project_id", args.project_id))
      .collect();
    return docs
      .filter((d) => d.council_decision !== "Deleted" && d.council_decision !== "Merged")
      .map(fromFindingRow);
  },
});

// ── challenges ────────────────────────────────────────────────────────────────

interface ChallengeInput {
  issue_id: string;
  challenger_discipline: string;
  decision: string;
  reason?: string;
  revised_risk?: Doc<"challenges">["revised_risk"];
  interface_discipline?: string;
  required_action?: string;
  model_used?: string;
}

export const insertChallenges = internalMutation({
  args: { project_id: v.id("projects"), challenges: v.array(v.any()) },
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const c of args.challenges as ChallengeInput[]) {
      await ctx.db.insert("challenges", {
        project_id: args.project_id,
        issue_id: c.issue_id,
        challenger_discipline: c.challenger_discipline,
        decision: c.decision,
        ...(c.revised_risk !== undefined ? { revised_risk: c.revised_risk } : {}),
        rationale: c.reason ?? "",
        ...(c.interface_discipline !== undefined
          ? { interface_discipline: c.interface_discipline }
          : {}),
        ...(c.required_action !== undefined ? { required_action: c.required_action } : {}),
        ...(c.model_used !== undefined ? { model_used: c.model_used } : {}),
        created_at: now,
      });
    }
  },
});

export const listChallenges = internalQuery({
  args: { project_id: v.id("projects") },
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("challenges")
      .withIndex("by_project", (q) => q.eq("project_id", args.project_id))
      .collect();
    // Round-trips ChallengeRecord, including interface_discipline so the
    // adjudicator can fold it into interface_disciplines (was dropped before).
    return docs.map((d) => ({
      issue_id: d.issue_id,
      challenger_discipline: d.challenger_discipline,
      decision: d.decision,
      reason: d.rationale,
      ...(d.revised_risk !== undefined ? { revised_risk: d.revised_risk } : {}),
      ...(d.interface_discipline !== undefined
        ? { interface_discipline: d.interface_discipline }
        : {}),
      ...(d.required_action !== undefined ? { required_action: d.required_action } : {}),
      model_used: d.model_used ?? "unknown",
    }));
  },
});

// ── adjudications ─────────────────────────────────────────────────────────────

interface AdjudicationInput {
  issue_id: string;
  council_decision: Doc<"adjudications">["council_decision"];
  rationale: string;
  post: { risk: Doc<"findings">["risk"] };
  adjudicator_model: string;
}

/**
 * Record the adjudications and patch each finding with its final state. Takes
 * the adjudicated findings too, so peer-added `interface_disciplines` (and any
 * other adjudication-time changes) are persisted — otherwise the chair report
 * reads a stale interface list (the in-memory port keeps the updated finding).
 */
export const saveAdjudications = internalMutation({
  args: {
    project_id: v.id("projects"),
    adjudicated: v.array(v.any()),
    decisions: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const finalById = new Map<string, FindingInput>();
    for (const f of args.adjudicated as FindingInput[]) finalById.set(f.issue_id, f);

    for (const d of args.decisions as AdjudicationInput[]) {
      await ctx.db.insert("adjudications", {
        project_id: args.project_id,
        issue_id: d.issue_id,
        council_decision: d.council_decision,
        rationale: d.rationale,
        adjudicator_model: d.adjudicator_model,
        adjudicated_at: now,
      });
      const finding = await ctx.db
        .query("findings")
        .withIndex("by_project_issue_id", (q) =>
          q.eq("project_id", args.project_id).eq("issue_id", d.issue_id),
        )
        .unique();
      if (finding) {
        const final = finalById.get(d.issue_id);
        await ctx.db.patch(finding._id, {
          council_decision: d.council_decision,
          rationale: d.rationale,
          risk: d.post.risk,
          ...(final ? { interface_disciplines: final.interface_disciplines ?? [] } : {}),
          updated_at: now,
        });
      }
    }
  },
});

// ── report ────────────────────────────────────────────────────────────────────

export const saveReport = internalMutation({
  args: {
    project_id: v.id("projects"),
    report: v.any(),
    version: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const r = args.report as Record<string, unknown>;
    const reportId = await ctx.db.insert("reports", {
      project_id: args.project_id,
      version: args.version ?? "v1",
      project_name: String(r.project_name ?? ""),
      project_stage: r.project_stage ? String(r.project_stage) : undefined,
      building_type: r.building_type ? String(r.building_type) : undefined,
      review_date: String(r.review_date ?? ""),
      regulatory_modules_activated: (r.regulatory_modules_activated as string[]) ?? [],
      disciplines_reviewed: (r.disciplines_reviewed as string[]) ?? [],
      build_readiness_rating: r.build_readiness_rating as Doc<"reports">["build_readiness_rating"],
      executive_decision: r.executive_decision as Doc<"reports">["executive_decision"],
      council_summary: String(r.council_summary ?? ""),
      final_recommendation: String(r.final_recommendation ?? ""),
      ...(r.corpus_version ? { corpus_version: String(r.corpus_version) } : {}),
      created_at: Date.now(),
    });
    // Persist the issue_id references per section (file 05 §05.3 / §05.4).
    const sections: Record<string, unknown> = r;
    for (const section of REPORT_SECTIONS) {
      const ids = sections[section];
      if (Array.isArray(ids)) {
        for (const issue_id of ids as string[]) {
          await ctx.db.insert("report_findings", { report_id: reportId, issue_id, section });
        }
      }
    }
    return reportId;
  },
});

const REPORT_SECTIONS = [
  "critical_blockers",
  "high_risk_conditions",
  "discipline_action_matrix",
  "interface_risk_matrix",
  "statutory_approval_risks",
  "planning_condition_risks",
  "tender_cost_risks",
  "construction_hold_points",
  "handover_evidence_requirements",
] as const;

/**
 * Rehydrate the full §05.3 BuildReadinessReport: the `reports` row plus the
 * per-section issue_id arrays from `report_findings`, with the locked disclaimer
 * re-attached. (The raw row alone omits the section arrays + disclaimer.)
 */
export const getReport = internalQuery({
  args: { project_id: v.id("projects") },
  handler: async (ctx, args) => {
    const reports = await ctx.db
      .query("reports")
      .withIndex("by_project", (q) => q.eq("project_id", args.project_id))
      .collect();
    const row = reports.length ? reports[reports.length - 1] : null;
    if (!row) return null;

    const refs = await ctx.db
      .query("report_findings")
      .withIndex("by_report", (q) => q.eq("report_id", row._id))
      .collect();
    const bySection: Record<string, string[]> = {};
    for (const ref of refs) (bySection[ref.section] ??= []).push(ref.issue_id);
    const section = (name: string): string[] => bySection[name] ?? [];

    return {
      project_name: row.project_name,
      project_stage: row.project_stage ?? "",
      building_type: row.building_type ?? "",
      review_date: row.review_date,
      regulatory_modules_activated: row.regulatory_modules_activated,
      disciplines_reviewed: row.disciplines_reviewed,
      build_readiness_rating: row.build_readiness_rating,
      executive_decision: row.executive_decision,
      council_summary: row.council_summary,
      critical_blockers: section("critical_blockers"),
      high_risk_conditions: section("high_risk_conditions"),
      discipline_action_matrix: section("discipline_action_matrix"),
      interface_risk_matrix: section("interface_risk_matrix"),
      statutory_approval_risks: section("statutory_approval_risks"),
      planning_condition_risks: section("planning_condition_risks"),
      tender_cost_risks: section("tender_cost_risks"),
      construction_hold_points: section("construction_hold_points"),
      handover_evidence_requirements: section("handover_evidence_requirements"),
      final_recommendation: row.final_recommendation,
      disclaimer: LOCKED_DISCLAIMER,
    };
  },
});

// ── audit ─────────────────────────────────────────────────────────────────────

export const appendOrchestratorAudit = internalMutation({
  args: { project_id: v.id("projects"), entry: v.any() },
  handler: async (ctx, args) => {
    const e = args.entry as { action?: string; stage?: string };
    await ctx.db.insert("audit_log", {
      project_id: args.project_id,
      actor: "orchestrator",
      action: String(e.action ?? "orchestrator"),
      target_type: "workflow",
      ...(e.stage ? { target_id: String(e.stage) } : {}),
      payload_json: JSON.stringify(args.entry),
      occurred_at: Date.now(),
    });
  },
});
