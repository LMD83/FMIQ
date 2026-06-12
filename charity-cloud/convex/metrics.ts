/**
 * Charity Cloud — charity dashboard v1 + analytics (PRD §9 targets).
 */
import { query } from "./_generated/server";
import { requireRole } from "./lib/rbac";

export const orgDashboard = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireRole(ctx, "orgAdmin", "caseworker");
    const orgId = user.orgId;
    if (!orgId) return null;
    const needs = await ctx.db
      .query("needs")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    const open = needs.filter((n) => n.status === "open").length;
    const fulfilled = needs.filter((n) => n.status === "fulfilled");

    // Median time-to-fulfil: publishedAt → match.completedAt.
    const durations: number[] = [];
    for (const n of fulfilled) {
      if (!n.publishedAt) continue;
      const match = await ctx.db
        .query("matches")
        .withIndex("by_need", (q) => q.eq("needId", n._id))
        .first();
      if (match?.completedAt) durations.push(match.completedAt - n.publishedAt);
    }
    durations.sort((a, b) => a - b);
    const mid = durations.length === 0 ? null : durations[Math.floor(durations.length / 2)];

    return {
      open,
      inReview: needs.filter((n) => n.status === "review").length,
      matched: needs.filter((n) => n.status === "matched").length,
      fulfilled: fulfilled.length,
      medianTimeToFulfilMs: mid ?? null,
    };
  },
});

export const platformMetrics = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, "platformOps");
    const events = await ctx.db.query("events").collect();
    const counts: Record<string, number> = {};
    for (const e of events) counts[e.name] = (counts[e.name] ?? 0) + 1;
    return counts;
  },
});
