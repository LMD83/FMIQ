/**
 * VerifIQ — scheduled functions (file 20 §2).
 *
 * Phase 4 schedules the inference-cache TTL purge. The job-dispatch tick that
 * drives the `jobs` table through per-stage actions also belongs here; it is
 * gated on prompt bundling for the Convex runtime (see docs/32) and lands with
 * that, so it is intentionally not wired yet.
 *
 * Version: 0.6.0-phase4
 */

import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

const crons = cronJobs();

// Drop expired inference-cache rows daily (30-day TTL; file 20 §2).
crons.daily("purge inference cache", { hourUTC: 3, minuteUTC: 0 }, api.cache.purgeExpired, {});

export default crons;
