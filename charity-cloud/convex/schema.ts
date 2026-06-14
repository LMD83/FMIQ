/**
 * Charity Cloud — Convex schema.
 *
 * Reconstructed from docs/08 build script (the original docs/05 §2 is not in
 * this repo; replace with the canonical schema when available and diff).
 *
 * Privacy invariants encoded structurally:
 *  - NO address / Eircode / coordinate field exists on ANY table. Location is
 *    a geohash-5 `geoCell` + human `areaLabel` only (rules 1, 9).
 *  - Requester-content tables (needs, messages) carry `ttlAt` (rule 5).
 *  - identityVault is reachable only via internal.* functions (rule 3).
 *  - needs carry a consent linkage; publish is gated on it (rule 6).
 */
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export const roleValidator = v.union(
  v.literal("platformOps"),
  v.literal("moderator"),
  v.literal("orgAdmin"),
  v.literal("caseworker"),
  v.literal("donor"),
);

export const needStatusValidator = v.union(
  v.literal("review"), // every need enters moderation first (DSA)
  v.literal("open"),
  v.literal("matched"),
  v.literal("fulfilled"),
  v.literal("removed"), // moderator removal (statement of reasons required)
  v.literal("expired"),
  v.literal("purged"), // TTL cron has replaced content
);

export const urgencyValidator = v.union(
  v.literal("urgent"),
  v.literal("soon"),
  v.literal("whenever"),
);

export default defineSchema({
  ...authTables,

  // Platform users. authId links to Convex Auth identity. Donors carry a
  // geoCell (NEVER an address) and alert preferences. donorReliability is an
  // internal counter (never user-visible; rule: W4 no-show handling).
  appUsers: defineTable({
    authUserId: v.id("users"), // authTables users row
    role: roleValidator,
    displayName: v.string(),
    email: v.string(),
    orgId: v.optional(v.id("orgs")),
    geoCell: v.optional(v.string()), // geohash-5, donors only
    areaLabel: v.optional(v.string()),
    alertCategories: v.optional(v.array(v.string())),
    donorReliability: v.optional(v.number()), // internal, not exposed in any DTO
  })
    .index("by_authUserId", ["authUserId"])
    .index("by_org", ["orgId"])
    .index("by_email", ["email"]),

  // Charities. RCN-verified (W1). allowedCategories constrained by purpose.
  orgs: defineTable({
    name: v.string(),
    rcn: v.string(), // Registered Charity Number
    status: v.union(v.literal("pending"), v.literal("verified"), v.literal("suspended")),
    purposeCategory: v.string(),
    allowedCategories: v.array(v.string()),
    registerCheckedAt: v.optional(v.number()),
  }).index("by_rcn", ["rcn"]),

  // Neutral handover points (org-managed). Public-safe by design.
  handoverPoints: defineTable({
    orgId: v.id("orgs"),
    label: v.string(), // e.g. "St. Vincent's Community Centre, front desk"
    areaLabel: v.string(),
    geoCell: v.string(),
    active: v.boolean(),
  }).index("by_org", ["orgId"]),

  // Verified needs, posted by caseworkers on behalf of pseudonymous clients.
  // privateNote NEVER leaves the server (public DTO snapshot test enforces).
  needs: defineTable({
    orgId: v.id("orgs"),
    postedByUserId: v.id("appUsers"), // never public
    pseudonym: v.string(), // "A neighbour in <areaLabel>"
    category: v.string(),
    subcategory: v.string(),
    conditionAccepted: v.string(), // e.g. "new only", "good used"
    urgency: urgencyValidator,
    qty: v.number(),
    privateNote: v.optional(v.string()), // caseworker-only, ≤280 chars
    handoverPointId: v.id("handoverPoints"),
    geoCell: v.string(),
    areaLabel: v.string(),
    status: needStatusValidator,
    publishedAt: v.optional(v.number()),
    ttlAt: v.number(), // rule 5: hourly purge cron
  })
    .index("by_status_cell", ["status", "geoCell"])
    .index("by_org", ["orgId"])
    .index("by_ttl", ["ttlAt"]),

  // Consent rows (rule 6): needs.publish requires a live consent; withdrawal
  // cascades to unpublish.
  consents: defineTable({
    needId: v.id("needs"),
    grantedByUserId: v.id("appUsers"), // caseworker confirming client consent
    status: v.union(v.literal("granted"), v.literal("withdrawn")),
    withdrawnAt: v.optional(v.number()),
  }).index("by_need", ["needId"]),

  // Donor offers: first accepted wins; competing pending offers auto-release.
  offers: defineTable({
    needId: v.id("needs"),
    donorUserId: v.id("appUsers"),
    photoStorageId: v.optional(v.id("_storage")),
    conditionNote: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("released"),
      v.literal("withdrawn"),
    ),
  })
    .index("by_need", ["needId"])
    .index("by_donor", ["donorUserId"]),

  // A match = accepted offer + handover point. Chat hangs off this.
  matches: defineTable({
    needId: v.id("needs"),
    offerId: v.id("offers"),
    donorUserId: v.id("appUsers"),
    orgId: v.id("orgs"),
    handoverPointId: v.id("handoverPoints"),
    status: v.union(v.literal("active"), v.literal("completed"), v.literal("released")),
    completedAt: v.optional(v.number()),
  })
    .index("by_need", ["needId"])
    .index("by_donor", ["donorUserId"])
    .index("by_org", ["orgId"]),

  // In-app chat. PII regex guard runs on send (rule 7). TTL'd (rule 5).
  messages: defineTable({
    matchId: v.id("matches"),
    senderUserId: v.id("appUsers"),
    body: v.string(),
    flagged: v.boolean(),
    ttlAt: v.number(),
  })
    .index("by_match", ["matchId"])
    .index("by_ttl", ["ttlAt"]),

  // DSA notice-and-action + first-pass review queue (Art 16/17).
  moderationItems: defineTable({
    kind: v.union(v.literal("needReview"), v.literal("report"), v.literal("chatFlag")),
    needId: v.optional(v.id("needs")),
    messageId: v.optional(v.id("messages")),
    reporterUserId: v.optional(v.id("appUsers")),
    reason: v.optional(v.string()),
    status: v.union(v.literal("open"), v.literal("resolved")),
    resolution: v.optional(v.union(v.literal("approved"), v.literal("removed"), v.literal("dismissed"))),
    statementOfReasons: v.optional(v.string()), // required on removal (Art 17)
    resolvedByUserId: v.optional(v.id("appUsers")),
    resolvedAt: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_need", ["needId"]),

  // Requester identity vault (rule 3): org's own client reference only —
  // no names, no PPSN, no addresses. Touched ONLY by internal.* functions;
  // every read writes auditLog.
  identityVault: defineTable({
    orgId: v.id("orgs"),
    needId: v.id("needs"),
    clientRef: v.string(), // org-internal case reference, opaque to platform
  }).index("by_need", ["needId"]),

  // Role invites (orgAdmin → caseworker, platformOps → moderator/orgAdmin).
  // Claimed at first sign-in by email match; unclaimed signups become donors.
  invites: defineTable({
    email: v.string(),
    role: roleValidator,
    orgId: v.optional(v.id("orgs")),
    claimed: v.boolean(),
  }).index("by_email", ["email"]),

  auditLog: defineTable({
    actorUserId: v.optional(v.id("appUsers")),
    action: v.string(),
    subject: v.string(), // e.g. "need:<id>", "vault:<id>"
    meta: v.optional(v.string()),
  }).index("by_subject", ["subject"]),

  // Analytics events (PRD §9 targets): post, view, offer, accept, fulfil,
  // noShow, report. Aggregated by the metrics query.
  events: defineTable({
    name: v.string(),
    meta: v.optional(v.string()),
  }).index("by_name", ["name"]),

  // Post-purge retention stats (category+cell only — no content, rule 5).
  purgeStats: defineTable({
    category: v.string(),
    geoCell: v.string(),
    purgedCount: v.number(),
  }).index("by_cat_cell", ["category", "geoCell"]),
});
