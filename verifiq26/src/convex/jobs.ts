/**
 * VerifIQ — job queue Convex functions (file 20 §2).
 *
 * The persistent side of the orchestrator's queue: enqueue (idempotent),
 * dependency-gated claim, completion/failure with retry backoff, and the
 * project scan-state advance. The scheduled `runner.tick` action (Phase 5)
 * claims the next runnable job and dispatches it to the council handler; this
 * module provides the data operations that tick is built from.
 *
 * These are all `internal*` functions: the queue is driven by the trusted runner
 * /cron, never a public client (a public `mutation`/`query` here would be an IDOR
 * surface — any caller with a `project_id` could read/write the queue). A future
 * authed "start review" entry point wraps `enqueueJob` behind Clerk membership.
 *
 * Audit-log writes elsewhere are mutations (never actions) so they survive
 * action retries (file 20 §2); the same holds for these job-state writes.
 *
 * Version: 0.8.0-phase5
 */

import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { JobType, ScanState } from "./schema";

/** Retry backoff in ms for a given attempt count (2s, 4s, 8s …). */
function backoffMs(attempt: number): number {
  return 1000 * 2 ** attempt;
}

/** Enqueue a job. Idempotent on `idempotency_key` (file 20 §2). */
export const enqueueJob = internalMutation({
  args: {
    project_id: v.id("projects"),
    job_type: JobType,
    payload: v.string(),
    idempotency_key: v.string(),
    depends_on: v.optional(v.array(v.id("jobs"))),
    scheduled_for: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("jobs")
      .withIndex("by_idempotency_key", (q) => q.eq("idempotency_key", args.idempotency_key))
      .unique();
    if (existing) return existing._id;
    return ctx.db.insert("jobs", {
      project_id: args.project_id,
      job_type: args.job_type,
      payload: args.payload,
      status: "pending",
      attempts: 0,
      idempotency_key: args.idempotency_key,
      depends_on: args.depends_on ?? [],
      scheduled_for: args.scheduled_for ?? Date.now(),
      created_at: Date.now(),
    });
  },
});

/**
 * Claim the next runnable job: a pending/retrying job whose `scheduled_for` has
 * passed and whose every dependency has succeeded. Marks it running and returns
 * it, or null when nothing is runnable.
 */
export const claimNextRunnable = internalMutation({
  args: { project_id: v.id("projects"), now: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now();
    const candidates = await ctx.db
      .query("jobs")
      .withIndex("by_project", (q) => q.eq("project_id", args.project_id))
      .collect();
    for (const job of candidates) {
      if (job.status !== "pending" && job.status !== "retrying") continue;
      if ((job.scheduled_for ?? 0) > now) continue;
      let ready = true;
      for (const depId of job.depends_on) {
        const dep = await ctx.db.get(depId);
        if (!dep || dep.status !== "succeeded") {
          ready = false;
          break;
        }
      }
      if (!ready) continue;
      await ctx.db.patch(job._id, {
        status: "running",
        attempts: job.attempts + 1,
        started_at: now,
      });
      return { ...job, status: "running" as const, attempts: job.attempts + 1 };
    }
    return null;
  },
});

/** Mark a running job succeeded. */
export const completeJob = internalMutation({
  args: { job_id: v.id("jobs"), result_ref: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.job_id, {
      status: "succeeded",
      completed_at: Date.now(),
      ...(args.result_ref !== undefined ? { result_ref: args.result_ref } : {}),
    });
  },
});

/** Fail a job: reschedule with backoff while attempts remain, else mark failed. */
export const failJob = internalMutation({
  args: { job_id: v.id("jobs"), error: v.string(), max_attempts: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.job_id);
    if (!job) return;
    const maxAttempts = args.max_attempts ?? 3;
    if (job.attempts < maxAttempts) {
      await ctx.db.patch(args.job_id, {
        status: "retrying",
        error: args.error,
        scheduled_for: Date.now() + backoffMs(job.attempts),
      });
    } else {
      await ctx.db.patch(args.job_id, {
        status: "failed",
        error: args.error,
        completed_at: Date.now(),
      });
    }
  },
});

/** Advance a project's scan state (file 20 §5 state machine). */
export const advanceScanState = internalMutation({
  args: { project_id: v.id("projects"), scan_state: ScanState },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.project_id, {
      scan_state: args.scan_state,
      updated_at: Date.now(),
    });
  },
});

/** List jobs for a project (queue inspection / dashboard). */
export const listJobs = internalQuery({
  args: { project_id: v.id("projects") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("jobs")
      .withIndex("by_project", (q) => q.eq("project_id", args.project_id))
      .collect();
  },
});

/**
 * Distinct project ids with at least one pending/retrying job. The global
 * `runner.tick` cron uses this to know which projects to drain (the claim is
 * per-project), so it scans the small set of waiting work, not every project.
 */
export const pendingProjectIds = internalQuery({
  args: {},
  handler: async (ctx) => {
    const ids = new Set<string>();
    for (const status of ["pending", "retrying"] as const) {
      const waiting = await ctx.db
        .query("jobs")
        .withIndex("by_status", (q) => q.eq("status", status))
        .collect();
      for (const job of waiting) ids.add(job.project_id);
    }
    return [...ids];
  },
});
