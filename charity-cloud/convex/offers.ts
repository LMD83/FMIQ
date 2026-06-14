/**
 * Charity Cloud — donor offers (W3).
 *
 * makeOffer: donor says "I have this" (+ optional photo + condition note).
 * accept: caseworker accepts ONE offer — the mutation transactionally accepts
 * it, releases all competing pending offers, creates the match, and flips the
 * need to "matched". Convex mutations are serializable transactions, so the
 * "first accepted wins" race is settled by the database, not the client
 * (tested in tests/match.test.ts).
 */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireRole } from "./lib/rbac";
import { cleanFreeText } from "./lib/guards";

export const make = mutation({
  args: {
    needId: v.id("needs"),
    conditionNote: v.string(),
    photoStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const donor = await requireRole(ctx, "donor");
    const need = await ctx.db.get(args.needId);
    if (!need || need.status !== "open") throw new Error("Need is not open");
    const existing = await ctx.db
      .query("offers")
      .withIndex("by_need", (q) => q.eq("needId", args.needId))
      .collect();
    if (existing.some((o) => o.donorUserId === donor._id && o.status === "pending")) {
      throw new Error("You already have a pending offer on this need");
    }
    const offerId = await ctx.db.insert("offers", {
      needId: args.needId,
      donorUserId: donor._id,
      ...(args.photoStorageId ? { photoStorageId: args.photoStorageId } : {}),
      conditionNote: cleanFreeText(args.conditionNote).text,
      status: "pending",
    });
    await ctx.db.insert("events", { name: "offer" });
    return offerId;
  },
});

export const withdraw = mutation({
  args: { offerId: v.id("offers") },
  handler: async (ctx, args) => {
    const donor = await requireRole(ctx, "donor");
    const offer = await ctx.db.get(args.offerId);
    if (!offer || offer.donorUserId !== donor._id) throw new Error("Not your offer");
    if (offer.status !== "pending") throw new Error("Offer is not pending");
    await ctx.db.patch(args.offerId, { status: "withdrawn" });
  },
});

/** Caseworker accepts an offer: first accepted wins, rest auto-release. */
export const accept = mutation({
  args: { offerId: v.id("offers") },
  handler: async (ctx, args) => {
    const caseworker = await requireRole(ctx, "caseworker", "orgAdmin");
    const offer = await ctx.db.get(args.offerId);
    if (!offer) throw new Error("Offer not found");
    const need = await ctx.db.get(offer.needId);
    if (!need) throw new Error("Need not found");
    if (need.orgId !== caseworker.orgId) throw new Error("Forbidden: wrong organisation");
    // The race guard: only an open need can be matched; the transaction makes
    // the second concurrent accept observe status "matched" and throw.
    if (need.status !== "open") throw new Error("Need is no longer open");
    if (offer.status !== "pending") throw new Error("Offer is no longer pending");

    await ctx.db.patch(offer._id, { status: "accepted" });
    const siblings = await ctx.db
      .query("offers")
      .withIndex("by_need", (q) => q.eq("needId", offer.needId))
      .collect();
    for (const s of siblings) {
      if (s._id !== offer._id && s.status === "pending") {
        await ctx.db.patch(s._id, { status: "released" });
      }
    }
    await ctx.db.patch(need._id, { status: "matched" });
    const matchId = await ctx.db.insert("matches", {
      needId: need._id,
      offerId: offer._id,
      donorUserId: offer.donorUserId,
      orgId: need.orgId,
      handoverPointId: need.handoverPointId,
      status: "active",
    });
    await ctx.db.insert("events", { name: "accept" });
    await ctx.db.insert("auditLog", {
      actorUserId: caseworker._id,
      action: "offer.accepted",
      subject: `match:${matchId}`,
    });
    return matchId;
  },
});

/** Offers on a need (org side: caseworker reviewing what came in). */
export const forNeed = query({
  args: { needId: v.id("needs") },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, "caseworker", "orgAdmin");
    const need = await ctx.db.get(args.needId);
    if (!need || need.orgId !== user.orgId) throw new Error("Forbidden");
    const offers = await ctx.db
      .query("offers")
      .withIndex("by_need", (q) => q.eq("needId", args.needId))
      .collect();
    const out = [];
    for (const o of offers) {
      out.push({
        id: o._id,
        conditionNote: o.conditionNote,
        status: o.status,
        photoUrl: o.photoStorageId ? await ctx.storage.getUrl(o.photoStorageId) : null,
      });
    }
    return out;
  },
});

/** The donor's own offers (their dashboard). */
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const donor = await requireRole(ctx, "donor");
    const offers = await ctx.db
      .query("offers")
      .withIndex("by_donor", (q) => q.eq("donorUserId", donor._id))
      .collect();
    const out = [];
    for (const o of offers) {
      const need = await ctx.db.get(o.needId);
      out.push({
        id: o._id,
        status: o.status,
        conditionNote: o.conditionNote,
        need: need
          ? { pseudonym: need.pseudonym, category: need.category, subcategory: need.subcategory }
          : null,
      });
    }
    return out;
  },
});

/** Donor photo upload target (Convex storage). */
export const photoUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, "donor");
    return await ctx.storage.generateUploadUrl();
  },
});
