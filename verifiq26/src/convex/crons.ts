/**
 * VerifIQ — scheduled jobs (Phase 4).
 *
 * Convex cron registry. Currently drives the inference-cache TTL cleanup
 * (file 20 §2). The 60-second job-queue `tick` that claims runnable jobs
 * (`jobs.claimNextRunnable`) and dispatches them to the orchestrator runner is
 * added once the runner action lands (it needs prompt bundling + PDF text
 * extraction — see docs/33).
 *
 * Version: 0.7.0-phase4
 */

import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Purge expired inference_cache rows nightly (30-day TTL; file 20 §2).
crons.daily(
  "purge expired inference cache",
  { hourUTC: 3, minuteUTC: 0 },
  internal.cache.purgeExpired,
  {},
);

export default crons;
