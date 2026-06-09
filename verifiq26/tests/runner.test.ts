/**
 * VerifIQ — job-queue runner core tests (Phase 5).
 *
 * Exercises the pure dispatch loop (claim → handler → complete/fail) with a fake
 * queue + fake handlers — no Convex — covering success, handler failure,
 * unregistered job_type, idle, and the bounded drain.
 *
 * Version: 0.8.0-phase5
 */

import { describe, it, expect } from "vitest";
import {
  runNextJob,
  drainQueue,
  type RunnerJob,
  type RunnerPorts,
  type JobHandler,
} from "../src/orchestrator/runner.js";

function job(id: string, type = "review_discipline"): RunnerJob {
  return { _id: id, project_id: "p1", job_type: type, payload: "{}" };
}

/** A fake queue that hands out a fixed list of jobs, recording completions/failures. */
function fakeQueue(queue: RunnerJob[]) {
  const completed: Array<{ id: string; resultRef?: string }> = [];
  const failed: Array<{ id: string; error: string }> = [];
  const ports: RunnerPorts = {
    claimNext: async () => queue.shift() ?? null,
    complete: async (id, resultRef) => void completed.push({ id, resultRef }),
    fail: async (id, error) => void failed.push({ id, error }),
  };
  return { ports, completed, failed };
}

describe("runNextJob", () => {
  it("runs the handler and completes with its result_ref", async () => {
    const { ports, completed } = fakeQueue([job("j1")]);
    const handlers: Record<string, JobHandler> = {
      review_discipline: async () => "report:p1",
    };
    const outcome = await runNextJob(ports, handlers);
    expect(outcome).toEqual({
      status: "completed",
      jobId: "j1",
      jobType: "review_discipline",
      resultRef: "report:p1",
    });
    expect(completed).toEqual([{ id: "j1", resultRef: "report:p1" }]);
  });

  it("returns idle when nothing is runnable", async () => {
    const { ports } = fakeQueue([]);
    expect(await runNextJob(ports, {})).toEqual({ status: "idle" });
  });

  it("fails the job (for backoff/retry) when the handler throws", async () => {
    const { ports, failed, completed } = fakeQueue([job("j2")]);
    const handlers: Record<string, JobHandler> = {
      review_discipline: async () => {
        throw new Error("LLM unavailable");
      },
    };
    const outcome = await runNextJob(ports, handlers);
    expect(outcome).toMatchObject({ status: "failed", jobId: "j2", error: "LLM unavailable" });
    expect(failed).toEqual([{ id: "j2", error: "LLM unavailable" }]);
    expect(completed).toEqual([]);
  });

  it("fails an unregistered job_type with a clear message", async () => {
    const { ports, failed } = fakeQueue([job("j3", "mystery")]);
    const outcome = await runNextJob(ports, {});
    expect(outcome).toEqual({ status: "unhandled", jobId: "j3", jobType: "mystery" });
    expect(failed[0]?.error).toMatch(/No handler registered for job_type "mystery"/);
  });
});

describe("drainQueue", () => {
  it("drains until idle, bounded by max", async () => {
    const { ports, completed } = fakeQueue([job("a"), job("b"), job("c")]);
    const handlers: Record<string, JobHandler> = { review_discipline: async () => undefined };

    const outcomes = await drainQueue(ports, handlers, 2);
    expect(outcomes).toHaveLength(2); // capped at max, even though 3 were queued
    expect(completed.map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("stops early when the queue empties before max", async () => {
    const { ports, completed } = fakeQueue([job("a")]);
    const handlers: Record<string, JobHandler> = { review_discipline: async () => undefined };

    const outcomes = await drainQueue(ports, handlers, 10);
    expect(outcomes).toHaveLength(1);
    expect(completed.map((c) => c.id)).toEqual(["a"]);
  });
});
