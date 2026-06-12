/**
 * Charity Cloud — matches + fulfilment + no-show handling (W4).
 *
 * confirmFulfilment (caseworker): match → completed, need → fulfilled, donor
 * gets an in-app impact receipt (email digest is roadmap). release (either
 * side): need reopens; a donor no-show decrements the INTERNAL reliability
 * counter — never user-visible (no DTO exposes it).
 */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireRole, currentUser } from "./lib/rbac";
import { matchParticipantDto } from "./lib/dto";

export const myMatches = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user) return [];
    let rows;
    if (user.role === "donor") {
      rows = await ctx.db
        .query("matches")
        .withIndex("by_donor", (q) => q.eq("donorUserId", user._id))
        .collect();
    } else if (user.orgId) {
      const orgId = user.orgId;
      rows = await ctx.db
        .query("matches")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect();
    } else {
      return [];
    }
    const out = [];
    for (const m of rows) {
      const need = await ctx.db.get(m.needId);
      const handover = await ctx.db.get(m.handoverPointId);
      if (need && handover) out.push(matchParticipantDto(m, need, handover));
    }
    return out;
  },
});

export const confirmFulfilment = mutation({
  args: { matchId: v.id("matches") },
  handler: async (ctx, args) => {
    const caseworker = await requireRole(ctx, "caseworker", "orgAdmin");
    const match = await ctx.db.get(args.matchId);
    if (!match || match.orgId !== caseworker.orgId) throw new Error("Forbidden");
    if (match.status !== "active") throw new Error("Match is not active");
    await ctx.db.patch(match._id, { status: "completed", completedAt: Date.now() });
    await ctx.db.patch(match.needId, { status: "fulfilled" });
    // Internal reliability credit + impact event (in-app receipt reads events).
    const donor = await ctx.db.get(match.donorUserId);
    if (donor) {
      await ctx.db.patch(donor._id, {
        donorReliability: (donor.donorReliability ?? 0) + 1,
      });
    }
    await ctx.db.insert("events", { name: "fulfil", meta: `match:${match._id}` });
    await ctx.db.insert("auditLog", {
      actorUserId: caseworker._id,
      action: "match.fulfilled",
      subject: `match:${match._id}`,
    });
  },
});

export const release = mutation({
  args: { matchId: v.id("matches"), donorNoShow: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const user = await currentUser(ctx);
    if (!user) throw new Error("Not signed in");
    const match = await ctx.db.get(args.matchId);
    if (!match || match.status !== "active") throw new Error("Match is not active");
    const isDonorSide = user._id === match.donorUserId;
    const isOrgSide =
      (user.role === "caseworker" || user.role === "orgAdmin") && user.orgId === match.orgId;
    if (!isDonorSide && !isOrgSide) throw new Error("Forbidden");

    await ctx.db.patch(match._id, { status: "released" });
    // Need reopens for other donors.
    const need = await ctx.db.get(match.needId);
    if (need && need.status === "matched") {
      await ctx.db.patch(need._id, { status: "open" });
    }
    // Org reporting a donor no-show → internal counter only (never visible).
    if (isOrgSide && args.donorNoShow) {
      const donor = await ctx.db.get(match.donorUserId);
      if (donor) {
        await ctx.db.patch(donor._id, {
          donorReliability: (donor.donorReliability ?? 0) - 1,
        });
      }
      await ctx.db.insert("events", { name: "noShow" });
    }
    await ctx.db.insert("auditLog", {
      actorUserId: user._id,
      action: "match.released",
      subject: `match:${match._id}`,
    });
  },
});

/** Donor impact receipts: their completed matches (W4 in-app receipt). */
export const myImpact = query({
  args: {},
  handler: async (ctx) => {
    const donor = await requireRole(ctx, "donor");
    const rows = await ctx.db
      .query("matches")
      .withIndex("by_donor", (q) => q.eq("donorUserId", donor._id))
      .collect();
    const completed = rows.filter((m) => m.status === "completed");
    const out = [];
    for (const m of completed) {
      const need = await ctx.db.get(m.needId);
      out.push({
        matchId: m._id,
        completedAt: m.completedAt ?? null,
        category: need?.category ?? "unknown",
        subcategory: need?.subcategory ?? "unknown",
        areaLabel: need?.areaLabel ?? "",
      });
    }
    return out;
  },
});
