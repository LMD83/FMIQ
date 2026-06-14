/**
 * Charity Cloud — the need loop (W2) + public feed (W3 read side) + consent.
 *
 * postNeed: caseworker-only; whitelist-enforced category; consent row created
 * (publish gated on it, rule 6); pseudonym generated; enters "review" status —
 * every need passes moderation before going public (DSA). The identityVault
 * row (org's own client ref) is written via the internal vault function.
 *
 * publicFeed: redacted DTO only (rule 2) — geo-matched to the caller's cell +
 * 8 neighbours when the caller is a donor with a cell set.
 */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireRole, currentUser } from "./lib/rbac";
import {
  assertAllowedCategory,
  cleanFreeText,
  NEED_TTL_MS,
  PRIVATE_NOTE_MAX,
} from "./lib/guards";
import { needPublicDto } from "./lib/dto";
import { searchCells, type Category, TAXONOMY } from "../packages/shared/src/index";
import { urgencyValidator } from "./schema";

export const post = mutation({
  args: {
    category: v.string(),
    subcategory: v.string(),
    conditionAccepted: v.string(),
    urgency: urgencyValidator,
    qty: v.number(),
    privateNote: v.optional(v.string()),
    handoverPointId: v.id("handoverPoints"),
    clientRef: v.string(), // org-internal case ref → identityVault only
    consentConfirmed: v.boolean(),
  },
  handler: async (ctx, args) => {
    const caseworker = await requireRole(ctx, "caseworker", "orgAdmin");
    if (!caseworker.orgId) throw new Error("No organisation");
    const org = await ctx.db.get(caseworker.orgId);
    if (!org || org.status !== "verified") throw new Error("Organisation not verified");

    // Rule 8: whitelist at the mutation layer.
    assertAllowedCategory(args.category, args.subcategory);
    if (!org.allowedCategories.includes(args.category)) {
      throw new Error("Category outside your organisation's permitted set");
    }
    if (!args.consentConfirmed) throw new Error("Client consent must be confirmed (rule 6)");
    if (args.qty < 1 || args.qty > 20) throw new Error("Quantity out of range");

    const handover = await ctx.db.get(args.handoverPointId);
    if (!handover || handover.orgId !== caseworker.orgId || !handover.active) {
      throw new Error("Invalid handover point");
    }

    // Rule 4: PPSN never stored, even in the caseworker-only note.
    let privateNote: string | undefined;
    if (args.privateNote) {
      if (args.privateNote.length > PRIVATE_NOTE_MAX) {
        throw new Error(`Private note over ${PRIVATE_NOTE_MAX} characters`);
      }
      privateNote = cleanFreeText(args.privateNote).text;
    }

    const pseudonym = `A neighbour in ${handover.areaLabel}`;
    const needId = await ctx.db.insert("needs", {
      orgId: caseworker.orgId,
      postedByUserId: caseworker._id,
      pseudonym,
      category: args.category,
      subcategory: args.subcategory,
      conditionAccepted: args.conditionAccepted,
      urgency: args.urgency,
      qty: args.qty,
      ...(privateNote ? { privateNote } : {}),
      handoverPointId: args.handoverPointId,
      geoCell: handover.geoCell,
      areaLabel: handover.areaLabel,
      status: "review",
      ttlAt: Date.now() + NEED_TTL_MS,
    });

    // Rule 6: live consent row, created with the need.
    await ctx.db.insert("consents", {
      needId,
      grantedByUserId: caseworker._id,
      status: "granted",
    });
    // Rule 3: client ref goes ONLY to the vault, via internal function.
    await ctx.runMutation(internal.vault.storeClientRef, {
      orgId: caseworker.orgId,
      needId,
      clientRef: args.clientRef,
    });
    // DSA: enters the moderation queue before publication.
    await ctx.db.insert("moderationItems", { kind: "needReview", needId, status: "open" });
    await ctx.db.insert("events", { name: "post" });
    await ctx.db.insert("auditLog", {
      actorUserId: caseworker._id,
      action: "need.posted",
      subject: `need:${needId}`,
    });
    return needId;
  },
});

/** Public, geo-matched donor feed. Redacted DTOs only (rule 2). */
export const publicFeed = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    // Donors with a cell get their 9-cell neighbourhood; everyone else
    // (including signed-out browsing) gets nothing location-specific.
    if (!user?.geoCell) return [];
    const cells = searchCells(user.geoCell);
    const rows = [];
    for (const cell of cells) {
      const inCell = await ctx.db
        .query("needs")
        .withIndex("by_status_cell", (q) => q.eq("status", "open").eq("geoCell", cell))
        .collect();
      rows.push(...inCell);
    }
    const urgencyRank = { urgent: 0, soon: 1, whenever: 2 } as const;
    rows.sort(
      (a, b) =>
        urgencyRank[a.urgency] - urgencyRank[b.urgency] ||
        (b.publishedAt ?? 0) - (a.publishedAt ?? 0),
    );
    await Promise.resolve(); // (events written by mutations only)
    return rows.map(needPublicDto);
  },
});

/** Org console: the org's own needs (full row minus nothing — org owns it). */
export const orgNeeds = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireRole(ctx, "caseworker", "orgAdmin");
    const orgId = user.orgId;
    if (!orgId) return [];
    const rows = await ctx.db
      .query("needs")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    return rows.map((n) => ({
      id: n._id,
      pseudonym: n.pseudonym,
      category: n.category,
      subcategory: n.subcategory,
      urgency: n.urgency,
      qty: n.qty,
      status: n.status,
      areaLabel: n.areaLabel,
      privateNote: n.privateNote ?? null, // org-side only
      publishedAt: n.publishedAt ?? null,
    }));
  },
});

/** Rule 6: consent withdrawal cascades to unpublish. */
export const withdrawConsent = mutation({
  args: { needId: v.id("needs") },
  handler: async (ctx, args) => {
    const need = await ctx.db.get(args.needId);
    if (!need) throw new Error("Not found");
    const user = await requireRole(ctx, "caseworker", "orgAdmin");
    if (user.orgId !== need.orgId) throw new Error("Forbidden: wrong organisation");
    const consent = await ctx.db
      .query("consents")
      .withIndex("by_need", (q) => q.eq("needId", args.needId))
      .first();
    if (consent) {
      await ctx.db.patch(consent._id, { status: "withdrawn", withdrawnAt: Date.now() });
    }
    // Cascade: unpublish whatever state it was in (open/review → removed).
    if (need.status === "open" || need.status === "review" || need.status === "matched") {
      await ctx.db.patch(args.needId, { status: "removed" });
    }
    await ctx.db.insert("auditLog", {
      actorUserId: user._id,
      action: "consent.withdrawn",
      subject: `need:${args.needId}`,
    });
  },
});

/** DSA Art 16: anyone signed-in can report a listing → moderation item. */
export const report = mutation({
  args: { needId: v.id("needs"), reason: v.string() },
  handler: async (ctx, args) => {
    const user = await currentUser(ctx);
    if (!user) throw new Error("Sign in to report");
    await ctx.db.insert("moderationItems", {
      kind: "report",
      needId: args.needId,
      reporterUserId: user._id,
      reason: cleanFreeText(args.reason).text,
      status: "open",
    });
    await ctx.db.insert("events", { name: "report" });
  },
});

/** Categories for pickers — derived from shared taxonomy (single source). */
export const taxonomy = query({
  args: {},
  handler: async () => {
    return Object.entries(TAXONOMY).map(([key, value]) => ({
      key: key as Category,
      label: value.label,
      subcategories: Object.entries(value.subcategories as Record<string, string>).map(
        ([k, l]) => ({ key: k, label: l }),
      ),
    }));
  },
});
