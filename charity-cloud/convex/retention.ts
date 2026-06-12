/**
 * Charity Cloud — TTL purge (rule 5).
 *
 * Hourly: every needs/messages row past ttlAt has its requester content
 * replaced with "[purged]"; a category+cell stats row is retained (no
 * content). Stale open needs expire. Injected `now` makes this testable
 * with a fake clock (tests/retention.test.ts).
 */
import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

export const purgeExpired = internalMutation({
  args: { now: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now();
    let purgedNeeds = 0;
    let purgedMessages = 0;

    const expiredNeeds = await ctx.db
      .query("needs")
      .withIndex("by_ttl", (q) => q.lte("ttlAt", now))
      .collect();
    for (const need of expiredNeeds) {
      if (need.status === "purged") continue;
      // Retain only category+cell stats (no content).
      const stat = await ctx.db
        .query("purgeStats")
        .withIndex("by_cat_cell", (q) =>
          q.eq("category", need.category).eq("geoCell", need.geoCell),
        )
        .unique();
      if (stat) {
        await ctx.db.patch(stat._id, { purgedCount: stat.purgedCount + 1 });
      } else {
        await ctx.db.insert("purgeStats", {
          category: need.category,
          geoCell: need.geoCell,
          purgedCount: 1,
        });
      }
      await ctx.db.patch(need._id, {
        status: "purged",
        pseudonym: "[purged]",
        conditionAccepted: "[purged]",
        privateNote: undefined,
        areaLabel: "[purged]",
      });
      purgedNeeds++;
    }

    const expiredMessages = await ctx.db
      .query("messages")
      .withIndex("by_ttl", (q) => q.lte("ttlAt", now))
      .collect();
    for (const message of expiredMessages) {
      if (message.body === "[purged]") continue;
      await ctx.db.patch(message._id, { body: "[purged]", flagged: false });
      purgedMessages++;
    }

    await ctx.db.insert("auditLog", {
      action: "retention.purge",
      subject: "cron:ttl-purge",
      meta: `needs=${purgedNeeds} messages=${purgedMessages}`,
    });
    return { purgedNeeds, purgedMessages };
  },
});
