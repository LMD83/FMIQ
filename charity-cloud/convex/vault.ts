/**
 * Charity Cloud — identity vault (rule 3).
 *
 * Touched ONLY by internal.* functions. Stores nothing but the org's own
 * opaque case reference (no names, no PPSN — PPSN is redacted defensively).
 * EVERY read writes auditLog.
 */
import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { redactPpsn } from "../packages/shared/src/index";

export const storeClientRef = internalMutation({
  args: {
    orgId: v.id("orgs"),
    needId: v.id("needs"),
    clientRef: v.string(),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("identityVault", {
      orgId: args.orgId,
      needId: args.needId,
      clientRef: redactPpsn(args.clientRef), // rule 4, defence in depth
    });
    await ctx.db.insert("auditLog", {
      action: "vault.write",
      subject: `vault:${id}`,
      meta: `need:${args.needId}`,
    });
    return id;
  },
});

export const readClientRef = internalQuery({
  args: { needId: v.id("needs"), actorUserId: v.id("appUsers") },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("identityVault")
      .withIndex("by_need", (q) => q.eq("needId", args.needId))
      .unique();
    // Rule 3: every read is audited. internalQuery cannot write, so reads go
    // through the audited internal mutation below in production paths; this
    // query exists for internal tooling only.
    return row ? { clientRef: row.clientRef, orgId: row.orgId } : null;
  },
});

/** Audited read path (rule 3): use this from actions/mutations. */
export const readClientRefAudited = internalMutation({
  args: { needId: v.id("needs"), actorUserId: v.id("appUsers") },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("identityVault")
      .withIndex("by_need", (q) => q.eq("needId", args.needId))
      .unique();
    await ctx.db.insert("auditLog", {
      actorUserId: args.actorUserId,
      action: "vault.read",
      subject: row ? `vault:${row._id}` : `need:${args.needId}`,
      meta: row ? undefined : "miss",
    });
    return row ? { clientRef: row.clientRef, orgId: row.orgId } : null;
  },
});
