/**
 * Charity Cloud — charity onboarding (W1) + handover points.
 *
 * Register flow: orgAdmin signs up → registers org with RCN → RCN check (the
 * register-lookup is stubbed behind an interface; see registerLookup.ts) →
 * status "pending" → platformOps approval → "verified". allowedCategories is
 * constrained by purposeCategory via PURPOSE_TO_CATEGORIES.
 */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireRole, requireOrgRole, currentUser } from "./lib/rbac";
import { PURPOSE_TO_CATEGORIES, resolveArea } from "../packages/shared/src/index";

export const register = mutation({
  args: {
    name: v.string(),
    rcn: v.string(),
    purposeCategory: v.string(),
    allowedCategories: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await currentUser(ctx);
    if (!user) throw new Error("Not signed in");
    if (user.orgId) throw new Error("Already attached to an organisation");
    const permitted = PURPOSE_TO_CATEGORIES[args.purposeCategory];
    if (!permitted) throw new Error("Unknown purpose category");
    for (const c of args.allowedCategories) {
      if (!(permitted as string[]).includes(c)) {
        throw new Error(`Category "${c}" not permitted for purpose "${args.purposeCategory}"`);
      }
    }
    const existing = await ctx.db
      .query("orgs")
      .withIndex("by_rcn", (q) => q.eq("rcn", args.rcn))
      .unique();
    if (existing) throw new Error("RCN already registered");
    const orgId = await ctx.db.insert("orgs", {
      name: args.name,
      rcn: args.rcn,
      status: "pending",
      purposeCategory: args.purposeCategory,
      allowedCategories: args.allowedCategories,
    });
    await ctx.db.patch(user._id, { orgId, role: "orgAdmin" });
    await ctx.db.insert("auditLog", {
      actorUserId: user._id,
      action: "org.registered",
      subject: `org:${orgId}`,
      meta: `rcn=${args.rcn}`,
    });
    return orgId;
  },
});

export const approve = mutation({
  args: { orgId: v.id("orgs") },
  handler: async (ctx, args) => {
    const ops = await requireRole(ctx, "platformOps");
    await ctx.db.patch(args.orgId, { status: "verified", registerCheckedAt: Date.now() });
    await ctx.db.insert("auditLog", {
      actorUserId: ops._id,
      action: "org.approved",
      subject: `org:${args.orgId}`,
    });
  },
});

export const myOrg = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user?.orgId) return null;
    const org = await ctx.db.get(user.orgId);
    if (!org) return null;
    return {
      id: org._id,
      name: org.name,
      rcn: org.rcn,
      status: org.status,
      purposeCategory: org.purposeCategory,
      allowedCategories: org.allowedCategories,
    };
  },
});

export const pendingOrgs = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, "platformOps");
    const orgs = await ctx.db.query("orgs").collect();
    return orgs
      .filter((o) => o.status === "pending")
      .map((o) => ({ id: o._id, name: o.name, rcn: o.rcn, purposeCategory: o.purposeCategory }));
  },
});

// ── handover points (orgAdmin CRUD) ─────────────────────────────────────────

export const addHandoverPoint = mutation({
  args: {
    label: v.string(),
    /** Eircode/routing key — resolved transiently (rule 1), never stored. */
    eircode: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await requireRole(ctx, "orgAdmin");
    if (!admin.orgId) throw new Error("No organisation");
    const area = resolveArea(args.eircode);
    if (!area) throw new Error("Unrecognised Eircode routing key");
    const id = await ctx.db.insert("handoverPoints", {
      orgId: admin.orgId,
      label: args.label,
      areaLabel: area.areaLabel,
      geoCell: area.geoCell,
      active: true,
    });
    await ctx.db.insert("auditLog", {
      actorUserId: admin._id,
      action: "handover.added",
      subject: `handover:${id}`,
    });
    return id;
  },
});

export const setHandoverActive = mutation({
  args: { id: v.id("handoverPoints"), active: v.boolean() },
  handler: async (ctx, args) => {
    const point = await ctx.db.get(args.id);
    if (!point) throw new Error("Not found");
    await requireOrgRole(ctx, point.orgId, "orgAdmin");
    await ctx.db.patch(args.id, { active: args.active });
  },
});

export const orgHandoverPoints = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireRole(ctx, "orgAdmin", "caseworker");
    const orgId = user.orgId;
    if (!orgId) return [];
    const points = await ctx.db
      .query("handoverPoints")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    return points.map((p) => ({
      id: p._id,
      label: p.label,
      areaLabel: p.areaLabel,
      active: p.active,
    }));
  },
});
