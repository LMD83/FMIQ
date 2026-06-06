/**
 * VerifIQ — in-memory job queue (file 20 §2 semantics).
 *
 * A dependency-gated job runner that mirrors the Convex `jobs` table model:
 * deterministic idempotency keys (enqueue is idempotent), `depends_on` ordering,
 * retry-with-backoff on failure, and per-tree isolation — a job whose
 * dependency permanently failed never runs, but independent job trees still
 * complete (architecture review failing must NOT fail M&E review, file 20).
 *
 * This is the testable reference scheduler; the Convex equivalent (jobs.ts)
 * persists the same shape and is ticked by a scheduled function in Phase 4.
 *
 * Version: 0.5.0-phase3
 */

export type JobStatus =
  | "pending"
  | "running"
  | "retryScheduled"
  | "succeeded"
  | "failed"
  | "blocked";

export interface JobSpec {
  /** Stable id within a run (e.g. "review:fire"). */
  id: string;
  type: string;
  payload?: unknown;
  /** Deterministic dedupe key (file 20 §2). Defaults to `${type}:${id}`. */
  idempotencyKey?: string;
  dependsOn?: string[];
  maxAttempts?: number;
}

export interface QueuedJob {
  id: string;
  type: string;
  payload: unknown;
  idempotencyKey: string;
  dependsOn: string[];
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  scheduledFor: number;
  error?: string;
}

export type JobHandler = (job: QueuedJob) => Promise<void>;

export interface RunSummary {
  succeeded: string[];
  failed: string[];
  blocked: string[];
}

const DEFAULT_MAX_ATTEMPTS = 3;
const BACKOFF_BASE_MS = 1000;

/** Backoff for attempt n (1-based): 2s, 4s, 8s … (file 20 §2 retrying). */
export function backoffMs(attempt: number): number {
  return BACKOFF_BASE_MS * 2 ** attempt;
}

export class InMemoryJobQueue {
  private jobs = new Map<string, QueuedJob>();
  private byKey = new Map<string, string>();
  private handlers = new Map<string, JobHandler>();
  private clock = 0;

  registerHandler(type: string, handler: JobHandler): void {
    this.handlers.set(type, handler);
  }

  /** Enqueue a job. Idempotent: a repeated idempotency key returns the existing id. */
  enqueue(spec: JobSpec): string {
    const key = spec.idempotencyKey ?? `${spec.type}:${spec.id}`;
    const existing = this.byKey.get(key);
    if (existing) return existing;
    const job: QueuedJob = {
      id: spec.id,
      type: spec.type,
      payload: spec.payload,
      idempotencyKey: key,
      dependsOn: spec.dependsOn ?? [],
      status: "pending",
      attempts: 0,
      maxAttempts: spec.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      scheduledFor: 0,
    };
    this.jobs.set(job.id, job);
    this.byKey.set(key, job.id);
    return job.id;
  }

  get(id: string): QueuedJob | undefined {
    return this.jobs.get(id);
  }

  list(): QueuedJob[] {
    return [...this.jobs.values()];
  }

  /**
   * Run all jobs to a terminal state. Uses a virtual clock so retry backoff is
   * deterministic and instant in tests. Returns the per-job outcome.
   */
  async runToCompletion(): Promise<RunSummary> {
    // Loop until every job is terminal (succeeded / failed / blocked).
    for (;;) {
      this.markBlocked();
      const runnable = this.list().find(
        (j) =>
          (j.status === "pending" || j.status === "retryScheduled") &&
          j.scheduledFor <= this.clock &&
          this.depsSucceeded(j),
      );

      if (!runnable) {
        // Nothing runnable now — advance the clock to the next scheduled retry.
        const next = this.list()
          .filter((j) => j.status === "retryScheduled")
          .reduce<number | null>(
            (min, j) => (min === null ? j.scheduledFor : Math.min(min, j.scheduledFor)),
            null,
          );
        if (next === null) break;
        this.clock = next;
        continue;
      }

      await this.dispatch(runnable);
    }

    const summary: RunSummary = { succeeded: [], failed: [], blocked: [] };
    for (const j of this.jobs.values()) {
      if (j.status === "succeeded") summary.succeeded.push(j.id);
      else if (j.status === "failed") summary.failed.push(j.id);
      else if (j.status === "blocked") summary.blocked.push(j.id);
    }
    return summary;
  }

  private async dispatch(job: QueuedJob): Promise<void> {
    const handler = this.handlers.get(job.type);
    job.status = "running";
    job.attempts += 1;
    if (!handler) {
      job.status = "failed";
      job.error = `no handler for job type "${job.type}"`;
      return;
    }
    try {
      await handler(job);
      job.status = "succeeded";
      delete job.error;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      job.error = message;
      if (job.attempts < job.maxAttempts) {
        job.status = "retryScheduled";
        job.scheduledFor = this.clock + backoffMs(job.attempts);
      } else {
        job.status = "failed";
      }
    }
  }

  /** Mark jobs whose dependencies have permanently failed/blocked as blocked. */
  private markBlocked(): void {
    for (const job of this.jobs.values()) {
      if (job.status !== "pending") continue;
      const deadDep = job.dependsOn.some((d) => {
        const dep = this.jobs.get(d);
        return dep && (dep.status === "failed" || dep.status === "blocked");
      });
      if (deadDep) job.status = "blocked";
    }
  }

  private depsSucceeded(job: QueuedJob): boolean {
    return job.dependsOn.every((d) => this.jobs.get(d)?.status === "succeeded");
  }
}
