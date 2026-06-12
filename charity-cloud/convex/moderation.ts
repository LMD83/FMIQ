/**
 * Charity Cloud — moderation (DSA Art 16/17, W2 step 3).
 *
 * Every need enters "review"; moderators approve → "open" (published) or
 * remove → statement of reasons REQUIRED and stored (delivered to the poster
 * via the org console). Reports and chat flags land in the same queue.
 * All actions audit-logged.
 */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireRole } from "./lib/rbac";

export const queue = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, "moderator", "platformOps");
    const items = await ctx.db
      .query("moderationItems")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .collect();
    const out = [];
    for (const item of items) {
      const need = item.needId ? await ctx.db.get(item.needId) : null;
      const message = item.messageId ? await ctx.db.get(item.messageId) : null;
      out.push({
        id: item._id,
        kind: item.kind,
        reason: item.reason ?? null,
        need: need
          ? {
              id: need._id,
              pseudonym: need.pseudonym,
              category: need.category,
              subcategory: need.subcategory,
              urgency: need.urgency,
              areaLabel: need.areaLabel,
              status: need.status,
            }
          : null,
        message: message ? { id: message._id, body: message.body, flagged: message.flagged } : null,
      });
    }
    return out;
  },
});

export const approveNeed = mutation({
  args: { itemId: v.id("moderationItems") },
  handler: async (ctx, args) => {
    const moderator = await requireRole(ctx, "moderator", "platformOps");
    const item = await ctx.db.get(args.itemId);
    if (!item || item.status !== "open" || !item.needId) throw new Error("Invalid item");
    const need = await ctx.db.get(item.needId);
    if (!need) throw new Error("Need gone");
    // Rule 6 re-check at publish time: consent must still be live.
    const consent = await ctx.db
      .query("consents")
      .withIndex("by_need", (q) => q.eq("needId", item.needId!))
      .first();
    if (!consent || consent.status !== "granted") {
      throw new Error("No live consent — cannot publish (rule 6)");
    }
    if (need.status === "review") {
      await ctx.db.patch(need._id, { status: "open", publishedAt: Date.now() });
    }
    await ctx.db.patch(args.itemId, {
      status: "resolved",
      resolution: "approved",
      resolvedByUserId: moderator._id,
      resolvedAt: Date.now(),
    });
    await ctx.db.insert("auditLog", {
      actorUserId: moderator._id,
      action: "moderation.approved",
      subject: `need:${need._id}`,
    });
  },
});

export const removeNeed = mutation({
  args: { itemId: v.id("moderationItems"), statementOfReasons: v.string() },
  handler: async (ctx, args) => {
    const moderator = await requireRole(ctx, "moderator", "platformOps");
    if (args.statementOfReasons.trim().length < 20) {
      throw new Error("Statement of reasons required (DSA Art 17) — be specific");
    }
    const item = await ctx.db.get(args.itemId);
    if (!item || item.status !== "open" || !item.needId) throw new Error("Invalid item");
    const need = await ctx.db.get(item.needId);
    if (need && need.status !== "fulfilled") {
      await ctx.db.patch(need._id, { status: "removed" });
    }
    await ctx.db.patch(args.itemId, {
      status: "resolved",
      resolution: "removed",
      statementOfReasons: args.statementOfReasons,
      resolvedByUserId: moderator._id,
      resolvedAt: Date.now(),
    });
    await ctx.db.insert("auditLog", {
      actorUserId: moderator._id,
      action: "moderation.removed",
      subject: `need:${item.needId}`,
      meta: "statementOfReasons recorded",
    });
  },
});

/** Chat-flag triage: dismiss or escalate (escalation = remove via report). */
export const resolveChatFlag = mutation({
  args: { itemId: v.id("moderationItems"), resolution: v.union(v.literal("dismissed"), v.literal("removed")) },
  handler: async (ctx, args) => {
    const moderator = await requireRole(ctx, "moderator", "platformOps");
    const item = await ctx.db.get(args.itemId);
    if (!item || item.status !== "open") throw new Error("Invalid item");
    if (args.resolution === "removed" && item.messageId) {
      await ctx.db.patch(item.messageId, { body: "[removed by moderation]" });
    }
    await ctx.db.patch(args.itemId, {
      status: "resolved",
      resolution: args.resolution,
      resolvedByUserId: moderator._id,
      resolvedAt: Date.now(),
    });
    await ctx.db.insert("auditLog", {
      actorUserId: moderator._id,
      action: `moderation.chatFlag.${args.resolution}`,
      subject: item.messageId ? `message:${item.messageId}` : `item:${item._id}`,
    });
  },
});

/** Org console: statements of reasons for the org's removed needs (Art 17 delivery). */
export const statementsForOrg = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireRole(ctx, "orgAdmin", "caseworker");
    if (!user.orgId) return [];
    const items = await ctx.db.query("moderationItems").collect();
    const out = [];
    for (const item of items) {
      if (item.resolution !== "removed" || !item.statementOfReasons || !item.needId) continue;
      const need = await ctx.db.get(item.needId);
      if (!need || need.orgId !== user.orgId) continue;
      out.push({
        needId: item.needId,
        category: need.category,
        subcategory: need.subcategory,
        statementOfReasons: item.statementOfReasons,
        resolvedAt: item.resolvedAt ?? null,
      });
    }
    return out;
  },
});
