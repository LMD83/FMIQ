/**
 * Charity Cloud — scheduled jobs (rule 5: retention is enforced hourly).
 */
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval("ttl-purge", { hours: 1 }, internal.retention.purgeExpired, {});

export default crons;
