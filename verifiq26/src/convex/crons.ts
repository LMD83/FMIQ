/**
 * VerifIQ — scheduled jobs (Phase 5).
 *
 * Convex cron registry: the nightly inference-cache TTL cleanup (file 20 §2) and
 * the 1-minute job-queue tick that claims runnable jobs and dispatches them to
 * the council runner (`runner.tick` → `jobs.claimNextRunnable`). Both call
 * `internal*` functions — the cron is a trusted caller.
 *
 * Version: 0.8.0-phase5
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

// Drain the persistent job queue every minute: claim runnable jobs across
// projects with waiting work and run the resumable review pipeline (file 20 §2).
crons.interval("drain review job queue", { minutes: 1 }, internal.runner.tick, {});

export default crons;
