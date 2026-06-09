/**
 * VerifIQ — review dispatch data functions (Phase 5).
 *
 * The query/mutation side of running a review on Convex: persist a scan's
 * RunInput, the public `requestReview` entry (with project-ownership check),
 * and the resumable-scan listing the scheduled tick uses. The heavy lifting
 * (agents + orchestrator) runs in the `review.runReview` node action; these are
 * regular Convex functions so they can touch the database.
 *
 * Auth note: Clerk wiring is deferred (CLAUDE.md), so the ownership check is
 * enforced only when an authenticated identity is present; the internal path
 * (cron/action) is already trusted. The workflow/cache mutations themselves are
 * `internalMutation`s, so the public surface here is the only client entry.
 *
 * Version: 0.7.0-phase5
 */

import { mutation, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

/** Non-terminal scan states a resume tick should re-dispatch. */
const RESUMABLE_STATES = ["scanning", "peer_challenge", "adjudicate", "reviewer_queue"] as const;

/** Load the persisted RunInput JSON for a project (most recent), or null. */
export const loadReviewInput = internalQuery({
  args: { project_id: v.id("projects") },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("review_inputs")
      .withIndex("by_project", (q) => q.eq("project_id", args.project_id))
      .order("desc")
      .first();
    return row?.payload_json ?? null;
  },
});

/**
 * Public entry: request a review run. Persists the RunInput and schedules the
 * node action. Enforces project ownership when an identity is present.
 */
export const requestReview = mutation({
  args: { project_id: v.id("projects"), payload_json: v.string() },
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

    const existing = await ctx.db
      .query("review_inputs")
      .withIndex("by_project", (q) => q.eq("project_id", args.project_id))
      .first();
    if (existing) await ctx.db.patch(existing._id, { payload_json: args.payload_json });
    else
      await ctx.db.insert("review_inputs", {
        project_id: args.project_id,
        payload_json: args.payload_json,
        created_at: Date.now(),
      });

    await ctx.scheduler.runAfter(0, internal.review.runReview, { project_id: args.project_id });
  },
});

/** Re-dispatch any interrupted scan that still has a persisted input (cron). */
export const resumeStalled = internalMutation({
  args: {},
  handler: async (ctx) => {
    let resumed = 0;
    for (const state of RESUMABLE_STATES) {
      const projects = await ctx.db
        .query("projects")
        .withIndex("by_scan_state", (q) => q.eq("scan_state", state))
        .collect();
      for (const project of projects) {
        const input = await ctx.db
          .query("review_inputs")
          .withIndex("by_project", (q) => q.eq("project_id", project._id))
          .first();
        if (!input) continue;
        await ctx.scheduler.runAfter(0, internal.review.runReview, { project_id: project._id });
        resumed++;
      }
    }
    return resumed;
  },
});
