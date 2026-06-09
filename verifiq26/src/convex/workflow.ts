/**
 * VerifIQ — workflow persistence Convex functions (Phase 4 binding).
 *
 * The data operations behind the orchestrator's `PersistencePort`
 * (src/orchestrator/types.ts). The `ConvexPersistence` adapter calls these via
 * an action's runMutation/runQuery so the resumable workflow
 * (src/orchestrator/workflow.ts) runs against the real schema tables —
 * findings (§05.1), challenges, adjudications, reports/report_findings,
 * workflow_state — instead of the in-memory reference store.
 *
 * Version: 0.6.0-phase4
 */

import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import {
  Stage,
  FindingStatus,
  Risk,
  BuildReadinessImpact,
  CouncilDecision,
  BuildReadinessRating,
  ExecutiveDecision,
  ScanState,
} from "./schema";
import { LOCKED_DISCLAIMER } from "../constants";

// §05.1 Finding wire shape (matches src/types Finding).
const findingArg = v.object({
  issue_id: v.string(),
  discipline_origin: v.string(),
  interface_disciplines: v.array(v.string()),
  stage: Stage,
  project_area: v.optional(v.string()),
  location: v.optional(v.string()),
  source_document: v.string(),
  source_reference: v.string(),
  related_documents: v.array(v.string()),
  requirement: v.string(),
  finding: v.string(),
  status: FindingStatus,
  risk: Risk,
  build_readiness_impact: BuildReadinessImpact,
  question: v.optional(v.string()),
  required_evidence: v.array(v.string()),
  owner: v.string(),
  secondary_owner: v.optional(v.string()),
  close_out_stage: v.optional(v.string()),
  council_decision: v.optional(CouncilDecision),
  rationale: v.optional(v.string()),
});

/** The §05.3 report section arrays, each a list of issue_ids. */
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

type FindingWire = (typeof findingArg)["type"];

function toFindingWire(doc: Record<string, unknown>): FindingWire {
  return {
    issue_id: doc.issue_id as string,
    discipline_origin: doc.discipline_origin as string,
    interface_disciplines: (doc.interface_disciplines as string[]) ?? [],
    stage: doc.stage as FindingWire["stage"],
    project_area: (doc.project_area as string) || undefined,
    location: (doc.location as string) || undefined,
    source_document: doc.source_document as string,
    source_reference: doc.source_reference as string,
    related_documents: (doc.related_documents as string[]) ?? [],
    requirement: doc.requirement as string,
    finding: doc.finding as string,
    status: doc.status as FindingWire["status"],
    risk: doc.risk as FindingWire["risk"],
    build_readiness_impact: doc.build_readiness_impact as FindingWire["build_readiness_impact"],
    question: (doc.question as string) || undefined,
    required_evidence: (doc.required_evidence as string[]) ?? [],
    owner: doc.owner as string,
    secondary_owner: (doc.secondary_owner as string) || undefined,
    close_out_stage: (doc.close_out_stage as string) || undefined,
    council_decision: (doc.council_decision as FindingWire["council_decision"]) || undefined,
    rationale: (doc.rationale as string) || undefined,
  };
}

// ── workflow_state ───────────────────────────────────────────────────────────

export const loadWorkflowState = internalQuery({
  args: { project_id: v.id("projects") },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("workflow_state")
      .withIndex("by_project", (q) => q.eq("project_id", args.project_id))
      .unique();
    if (!row) return null;
    return {
      project_id: args.project_id,
      scan_state: row.scan_state,
      completed_stages: row.completed_stages,
      discipline_status: row.discipline_status,
      updated_at: row.updated_at,
    };
  },
});

export const saveWorkflowState = internalMutation({
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
    const patch = {
      project_id: args.project_id,
      scan_state: args.scan_state,
      completed_stages: args.completed_stages,
      discipline_status: args.discipline_status,
      updated_at: Date.now(),
    };
    if (existing) await ctx.db.patch(existing._id, patch);
    else await ctx.db.insert("workflow_state", patch);
  },
});

// ── findings ─────────────────────────────────────────────────────────────────

export const saveFindings = internalMutation({
  args: { project_id: v.id("projects"), findings: v.array(findingArg) },
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const f of args.findings) {
      await ctx.db.insert("findings", { project_id: args.project_id, ...f, created_at: now, updated_at: now });
    }
  },
});

export const loadFindings = internalQuery({
  args: { project_id: v.id("projects") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("findings")
      .withIndex("by_project", (q) => q.eq("project_id", args.project_id))
      .collect();
    return rows.map((r) => toFindingWire(r as unknown as Record<string, unknown>));
  },
});

// ── challenges ───────────────────────────────────────────────────────────────

export const saveChallenges = internalMutation({
  args: {
    project_id: v.id("projects"),
    challenges: v.array(
      v.object({
        issue_id: v.string(),
        challenger_discipline: v.string(),
        decision: CouncilDecision,
        reason: v.string(),
        revised_risk: v.optional(Risk),
        interface_discipline: v.optional(v.string()),
        required_action: v.optional(v.string()),
        model_used: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const c of args.challenges) {
      await ctx.db.insert("challenges", {
        project_id: args.project_id,
        issue_id: c.issue_id,
        challenger_discipline: c.challenger_discipline,
        decision: c.decision,
        revised_risk: c.revised_risk,
        rationale: c.reason,
        interface_discipline: c.interface_discipline,
        required_action: c.required_action,
        model_used: c.model_used,
        created_at: now,
      });
    }
  },
});

export const loadChallenges = internalQuery({
  args: { project_id: v.id("projects") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("challenges")
      .withIndex("by_project", (q) => q.eq("project_id", args.project_id))
      .collect();
    return rows.map((r) => ({
      issue_id: r.issue_id,
      challenger_discipline: r.challenger_discipline,
      decision: r.decision as ReturnType<typeof String> as never,
      reason: r.rationale,
      revised_risk: r.revised_risk,
      interface_discipline: r.interface_discipline,
      required_action: r.required_action,
      model_used: r.model_used ?? "",
    }));
  },
});

// ── adjudications ────────────────────────────────────────────────────────────

export const saveAdjudications = internalMutation({
  args: {
    project_id: v.id("projects"),
    adjudicated: v.array(findingArg),
    decisions: v.array(
      v.object({
        issue_id: v.string(),
        council_decision: CouncilDecision,
        rationale: v.string(),
        adjudicator_model: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    // Audit rows (file 06 audit trail) + finding-row council_decision (§05.1).
    for (const d of args.decisions) {
      await ctx.db.insert("adjudications", {
        project_id: args.project_id,
        issue_id: d.issue_id,
        council_decision: d.council_decision,
        rationale: d.rationale,
        adjudicator_model: d.adjudicator_model,
        adjudicated_at: now,
      });
      const row = await ctx.db
        .query("findings")
        .withIndex("by_project_issue_id", (q) =>
          q.eq("project_id", args.project_id).eq("issue_id", d.issue_id),
        )
        .unique();
      if (row) {
        await ctx.db.patch(row._id, {
          council_decision: d.council_decision,
          rationale: d.rationale,
          updated_at: now,
        });
      }
    }
    // Apply the accepted register's adjudicated state (risk/status/impact).
    for (const f of args.adjudicated) {
      const row = await ctx.db
        .query("findings")
        .withIndex("by_project_issue_id", (q) =>
          q.eq("project_id", args.project_id).eq("issue_id", f.issue_id),
        )
        .unique();
      if (row) {
        await ctx.db.patch(row._id, {
          risk: f.risk,
          status: f.status,
          build_readiness_impact: f.build_readiness_impact,
          // Adjudication can extend interface_disciplines from peer challenges;
          // persist it so loadAdjudicated → chair sees the accepted register's
          // interface relationships (not the stale pre-adjudication list).
          interface_disciplines: f.interface_disciplines,
          council_decision: f.council_decision ?? row.council_decision,
          updated_at: now,
        });
      }
    }
  },
});

export const loadAdjudicated = internalQuery({
  args: { project_id: v.id("projects") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("findings")
      .withIndex("by_project", (q) => q.eq("project_id", args.project_id))
      .collect();
    return rows
      .filter((r) => r.council_decision && r.council_decision !== "Deleted")
      .map((r) => toFindingWire(r as unknown as Record<string, unknown>));
  },
});

// ── reports ──────────────────────────────────────────────────────────────────

export const saveReport = internalMutation({
  args: {
    project_id: v.id("projects"),
    report: v.object({
      project_name: v.string(),
      project_stage: v.string(),
      building_type: v.string(),
      review_date: v.string(),
      regulatory_modules_activated: v.array(v.string()),
      disciplines_reviewed: v.array(v.string()),
      build_readiness_rating: BuildReadinessRating,
      executive_decision: ExecutiveDecision,
      council_summary: v.string(),
      final_recommendation: v.string(),
      critical_blockers: v.array(v.string()),
      high_risk_conditions: v.array(v.string()),
      discipline_action_matrix: v.array(v.string()),
      interface_risk_matrix: v.array(v.string()),
      statutory_approval_risks: v.array(v.string()),
      planning_condition_risks: v.array(v.string()),
      tender_cost_risks: v.array(v.string()),
      construction_hold_points: v.array(v.string()),
      handover_evidence_requirements: v.array(v.string()),
    }),
    reviewer_initials: v.optional(v.string()),
    corpus_version: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const r = args.report;
    const reportId = await ctx.db.insert("reports", {
      project_id: args.project_id,
      version: new Date().toISOString(),
      project_name: r.project_name,
      project_stage: r.project_stage,
      building_type: r.building_type,
      review_date: r.review_date,
      regulatory_modules_activated: r.regulatory_modules_activated,
      disciplines_reviewed: r.disciplines_reviewed,
      build_readiness_rating: r.build_readiness_rating,
      executive_decision: r.executive_decision,
      council_summary: r.council_summary,
      final_recommendation: r.final_recommendation,
      reviewer_initials: args.reviewer_initials,
      corpus_version: args.corpus_version,
      created_at: Date.now(),
    });
    // Section membership via report_findings (issue_id refs; §05.4 note).
    for (const section of REPORT_SECTIONS) {
      for (const issueId of r[section]) {
        await ctx.db.insert("report_findings", { report_id: reportId, issue_id: issueId, section });
      }
    }
    return reportId;
  },
});

export const loadReport = internalQuery({
  args: { project_id: v.id("projects") },
  handler: async (ctx, args) => {
    const reports = await ctx.db
      .query("reports")
      .withIndex("by_project", (q) => q.eq("project_id", args.project_id))
      .order("desc")
      .collect();
    const latest = reports[0];
    if (!latest) return null;
    const links = await ctx.db
      .query("report_findings")
      .withIndex("by_report", (q) => q.eq("report_id", latest._id))
      .collect();
    const sections: Record<string, string[]> = {};
    for (const s of REPORT_SECTIONS) sections[s] = [];
    for (const link of links) {
      (sections[link.section] ??= []).push(link.issue_id);
    }
    return {
      project_name: latest.project_name,
      project_stage: latest.project_stage ?? "",
      building_type: latest.building_type ?? "",
      review_date: latest.review_date,
      regulatory_modules_activated: latest.regulatory_modules_activated,
      disciplines_reviewed: latest.disciplines_reviewed,
      build_readiness_rating: latest.build_readiness_rating,
      executive_decision: latest.executive_decision,
      council_summary: latest.council_summary,
      critical_blockers: sections.critical_blockers!,
      high_risk_conditions: sections.high_risk_conditions!,
      discipline_action_matrix: sections.discipline_action_matrix!,
      interface_risk_matrix: sections.interface_risk_matrix!,
      statutory_approval_risks: sections.statutory_approval_risks!,
      planning_condition_risks: sections.planning_condition_risks!,
      tender_cost_risks: sections.tender_cost_risks!,
      construction_hold_points: sections.construction_hold_points!,
      handover_evidence_requirements: sections.handover_evidence_requirements!,
      final_recommendation: latest.final_recommendation,
      disclaimer: LOCKED_DISCLAIMER,
    };
  },
});
