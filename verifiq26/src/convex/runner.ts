"use node";

/**
 * VerifIQ — server-side review runner (Phase 5, file 20 §2).
 *
 * The `"use node"` action that drives the persistent job queue. A 1-minute cron
 * (crons.ts) calls `tick`, which for each project with waiting work claims
 * runnable jobs and dispatches them to the council handler. The dispatch core
 * (claim → run → complete/fail with backoff) is the pure, unit-tested
 * `drainQueue` (src/orchestrator/runner.ts); this module only wires the real
 * Convex ports + the council into it.
 *
 * The council handler builds the orchestrator from bundled prompts (no node:fs),
 * env-keyed LLM providers, and a `ConvexPersistence` over the action ctx, then
 * runs the resumable pipeline. Because that pipeline is idempotent + resumable
 * (it skips completed stages from persisted state), every queue job_type maps to
 * the same handler — re-entry safely resumes rather than duplicating work.
 *
 * Live-credential gated: needs ANTHROPIC_API_KEY / OPENAI_API_KEY + a Convex
 * deployment, so it is verified locally (DEVELOPMENT.md), not in CI.
 *
 * Version: 0.8.0-phase5
 */

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import {
  drainQueue,
  type JobHandler,
  type RunnerJob,
  type RunnerPorts,
} from "../orchestrator/runner.js";
import {
  ConvexPersistence,
  type ConvexBackend,
  type StoredWorkflowState,
} from "../orchestrator/convex-persistence.js";
import { createCouncil } from "../orchestrator/council.js";
import { createOrchestrator, type RunInput } from "../orchestrator/index.js";
import { PromptLoader, RecordPromptSource } from "../agents/index.js";
import { PROMPT_BUNDLE } from "../agents/prompts.bundle.js";
import { createLLM } from "../llm/index.js";

const MAX_JOBS_PER_TICK = 10;

/** Every queue job_type drives the resumable pipeline (re-entry resumes safely). */
const HANDLED_JOB_TYPES = [
  "classify",
  "review_discipline",
  "cross_reference",
  "peer_challenge",
  "adjudicate",
  "report",
] as const;

/**
 * Claim + drain runnable jobs for the projects with waiting work. With an
 * explicit `project_id` it drains just that project (used to kick a fresh
 * review); otherwise it drains every project the queue reports as pending.
 */
export const tick = internalAction({
  args: { project_id: v.optional(v.id("projects")), max: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const projectIds: string[] = args.project_id
      ? [args.project_id]
      : await ctx.runQuery(internal.jobs.pendingProjectIds, {});

    const handlers = buildHandlers(ctx);
    const max = args.max ?? MAX_JOBS_PER_TICK;
    const summary: Array<{ projectId: string; ran: number }> = [];

    for (const projectId of projectIds) {
      const ports = buildPorts(ctx, projectId);
      const outcomes = await drainQueue(ports, handlers, max);
      summary.push({ projectId, ran: outcomes.length });
    }
    return summary;
  },
});

/* eslint-disable @typescript-eslint/no-explicit-any -- action ctx is generic; the
   stub-generated `internal` ref is `anyApi`, so these wrappers are intentionally
   loosely typed at the Convex boundary and validated at runtime by the callees. */
type RunnerCtx = {
  runQuery: (ref: any, args: any) => Promise<any>;
  runMutation: (ref: any, args: any) => Promise<any>;
};

/** Build the queue ports for one project from the action ctx. */
function buildPorts(ctx: RunnerCtx, projectId: string): RunnerPorts {
  return {
    claimNext: () =>
      ctx.runMutation(internal.jobs.claimNextRunnable, {
        project_id: projectId,
      }) as Promise<RunnerJob | null>,
    complete: (jobId, resultRef) =>
      ctx.runMutation(internal.jobs.completeJob, { job_id: jobId, result_ref: resultRef }),
    fail: (jobId, error) => ctx.runMutation(internal.jobs.failJob, { job_id: jobId, error }),
  };
}

/** The council handler, registered for every pipeline job_type. */
function buildHandlers(ctx: RunnerCtx): Record<string, JobHandler> {
  const run: JobHandler = async (job) => {
    const input = JSON.parse(job.payload) as RunInput;
    const orchestrator = createOrchestrator(
      createCouncil({
        llm: createLLM(),
        prompts: new PromptLoader(new RecordPromptSource(PROMPT_BUNDLE)),
        persistence: new ConvexPersistence(convexBackend(ctx)),
      }),
    );
    await orchestrator.run(input);
    return `report:${input.projectId}`;
  };
  return Object.fromEntries(HANDLED_JOB_TYPES.map((t) => [t, run]));
}

/** A ConvexBackend whose methods call persist.ts / jobs.ts via the action ctx. */
function convexBackend(ctx: RunnerCtx): ConvexBackend {
  return {
    getWorkflowState: (project_id) =>
      ctx.runQuery(internal.persist.getWorkflowState, { project_id }) as Promise<
        StoredWorkflowState | null
      >,
    upsertWorkflowState: (s) =>
      ctx.runMutation(internal.persist.upsertWorkflowState, {
        project_id: s.project_id,
        scan_state: s.scan_state,
        completed_stages: s.completed_stages,
        discipline_status: s.discipline_status,
      }),
    setScanState: (project_id, state) =>
      ctx.runMutation(internal.jobs.advanceScanState, { project_id, scan_state: state }),
    insertFindings: (project_id, findings) =>
      ctx.runMutation(internal.persist.insertFindings, { project_id, findings }),
    listFindings: (project_id) => ctx.runQuery(internal.persist.listFindings, { project_id }),
    insertChallenges: (project_id, challenges) =>
      ctx.runMutation(internal.persist.insertChallenges, { project_id, challenges }),
    listChallenges: (project_id) => ctx.runQuery(internal.persist.listChallenges, { project_id }),
    saveAdjudications: (project_id, adjudicated, decisions) =>
      ctx.runMutation(internal.persist.saveAdjudications, { project_id, adjudicated, decisions }),
    listAdjudicated: (project_id) => ctx.runQuery(internal.persist.listAdjudicated, { project_id }),
    saveReport: (project_id, report) =>
      ctx.runMutation(internal.persist.saveReport, { project_id, report }),
    getReport: (project_id) => ctx.runQuery(internal.persist.getReport, { project_id }),
    appendAudit: (project_id, entry) =>
      ctx.runMutation(internal.persist.appendOrchestratorAudit, { project_id, entry }),
  };
}
