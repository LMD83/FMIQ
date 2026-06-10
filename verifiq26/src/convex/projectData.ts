/**
 * VerifIQ — public project read queries (Phase 6 scaffolding).
 *
 * The read-side surface the frontend (and the `run-review` smoke script) use to
 * show scan progress and findings. Ownership is enforced when a Clerk identity is
 * present, mirroring `reviewData.requestReview`; the workflow/queue mutations stay
 * `internal*` per ADR-001. Read-only — there is no data mutation here.
 *
 * Version: 0.7.0-phase6
 */

import { query } from "./_generated/server";
import { v } from "convex/values";

/** Scan state + finding tallies for a project. Poll this to watch a review run. */
export const getProjectStatus = query({
  args: { project_id: v.id("projects") },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.project_id);
    if (!project) throw new Error("project not found");
    const identity = await ctx.auth.getUserIdentity();
    if (identity) {
      const owner = await ctx.db.get(project.owner_user_id);
      if (owner?.clerk_user_id && owner.clerk_user_id !== identity.subject) {
        throw new Error("not authorised for this project");
      }
    }

    const findings = await ctx.db
      .query("findings")
      .withIndex("by_project", (q) => q.eq("project_id", args.project_id))
      .collect();

    const bySeverity: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const f of findings) {
      const r = String(f.risk).toLowerCase();
      bySeverity[r] = (bySeverity[r] ?? 0) + 1;
    }

    return {
      name: project.name,
      scan_state: project.scan_state,
      finding_count: findings.length,
      by_severity: bySeverity,
    };
  },
});

/** All findings for a project, newest first. */
export const getProjectFindings = query({
  args: { project_id: v.id("projects") },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.project_id);
    if (!project) throw new Error("project not found");
    const identity = await ctx.auth.getUserIdentity();
    if (identity) {
      const owner = await ctx.db.get(project.owner_user_id);
      if (owner?.clerk_user_id && owner.clerk_user_id !== identity.subject) {
        throw new Error("not authorised for this project");
      }
    }

    return ctx.db
      .query("findings")
      .withIndex("by_project", (q) => q.eq("project_id", args.project_id))
      .order("desc")
      .collect();
  },
});

/** Recent projects (newest first) — the dashboard list. */
export const listProjects = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("projects").order("desc").take(50);
    return rows.map((p) => ({
      _id: p._id,
      name: p.name,
      scan_state: p.scan_state,
      building_type: p.building_type,
      created_at: p.created_at,
    }));
  },
});
