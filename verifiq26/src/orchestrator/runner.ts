/**
 * VerifIQ — job-queue runner core (Phase 5, file 20 §2).
 *
 * The pure, injectable heart of the scheduled queue tick: claim the next runnable
 * job, dispatch it to the handler registered for its `job_type`, and record
 * success/failure. All Convex I/O is behind `RunnerPorts` so this is unit-tested
 * without a deployment; the `"use node"` `tick` action (src/convex/runner.ts)
 * wires the real `internal.jobs.*` mutations + the council handler into it.
 *
 * Failure handling defers to the queue: `fail()` reschedules with backoff while
 * attempts remain, else marks the job failed (jobs.failJob). An unregistered
 * job_type fails the job with a clear message rather than throwing the tick.
 *
 * Version: 0.8.0-phase5
 */

/** The slice of a `jobs` row the runner needs to dispatch. */
export interface RunnerJob {
  _id: string;
  project_id: string;
  job_type: string;
  payload: string;
}

/** Convex-side operations the runner depends on (injected; see jobs.ts). */
export interface RunnerPorts {
  /** Claim the next runnable job for the scope, or null when none is runnable. */
  claimNext(): Promise<RunnerJob | null>;
  /** Mark a job succeeded, optionally recording a result reference. */
  complete(jobId: string, resultRef?: string): Promise<void>;
  /** Fail a job (the queue decides retry-with-backoff vs. terminal). */
  fail(jobId: string, error: string): Promise<void>;
}

/** Handles one job; an optional returned string is recorded as `result_ref`. */
export type JobHandler = (job: RunnerJob) => Promise<string | void>;

export type JobOutcome =
  | { status: "idle" }
  | { status: "completed"; jobId: string; jobType: string; resultRef?: string }
  | { status: "failed"; jobId: string; jobType: string; error: string }
  | { status: "unhandled"; jobId: string; jobType: string };

/** Claim and run a single job. Never throws — every path resolves to an outcome. */
export async function runNextJob(
  ports: RunnerPorts,
  handlers: Record<string, JobHandler>,
): Promise<JobOutcome> {
  const job = await ports.claimNext();
  if (!job) return { status: "idle" };

  const handler = handlers[job.job_type];
  if (!handler) {
    const error = `No handler registered for job_type "${job.job_type}"`;
    await ports.fail(job._id, error);
    return { status: "unhandled", jobId: job._id, jobType: job.job_type };
  }

  try {
    const resultRef = (await handler(job)) ?? undefined;
    await ports.complete(job._id, resultRef);
    return { status: "completed", jobId: job._id, jobType: job.job_type, resultRef };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await ports.fail(job._id, error);
    return { status: "failed", jobId: job._id, jobType: job.job_type, error };
  }
}

/**
 * Drain up to `max` runnable jobs this tick, stopping early once the queue is
 * idle. Bounded so a single tick can't run unboundedly; the next tick continues.
 */
export async function drainQueue(
  ports: RunnerPorts,
  handlers: Record<string, JobHandler>,
  max = 10,
): Promise<JobOutcome[]> {
  const outcomes: JobOutcome[] = [];
  for (let i = 0; i < max; i++) {
    const outcome = await runNextJob(ports, handlers);
    if (outcome.status === "idle") break;
    outcomes.push(outcome);
  }
  return outcomes;
}
