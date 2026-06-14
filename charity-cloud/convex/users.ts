/**
 * Charity Cloud — user profile functions.
 *
 * Sign-up flow: Convex Auth creates the auth row; the client then calls
 * `ensureProfile`. An unclaimed invite matching the email assigns the invited
 * role/org; otherwise the user becomes a donor. Donor location is resolved
 * TRANSIENTLY from the Eircode routing key (rule 1) — the input never
 * persists, only {geoCell, areaLabel}.
 */
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { currentUser, requireRole } from "./lib/rbac";
import { resolveArea } from "../packages/shared/src/index";

export const me = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user) return null;
    // Self-view DTO: donorReliability is internal-only (W4) — never exposed.
    return {
      id: user._id,
      role: user.role,
      displayName: user.displayName,
      email: user.email,
      orgId: user.orgId ?? null,
      areaLabel: user.areaLabel ?? null,
      alertCategories: user.alertCategories ?? [],
    };
  },
});

export const ensureProfile = mutation({
  args: {
    displayName: v.string(),
    email: v.string(),
    /** Donors only: Eircode or routing key — used transiently, never stored. */
    eircode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const authUserId = await getAuthUserId(ctx);
    if (authUserId === null) throw new Error("Not signed in");
    const existing = await ctx.db
      .query("appUsers")
      .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
      .unique();
    if (existing) return existing._id;

    const email = args.email.trim().toLowerCase();
    const invite = await ctx.db
      .query("invites")
      .withIndex("by_email", (q) => q.eq("email", email))
      .filter((q) => q.eq(q.field("claimed"), false))
      .first();

    let geoCell: string | undefined;
    let areaLabel: string | undefined;
    if (!invite && args.eircode) {
      const area = resolveArea(args.eircode); // transient — input discarded
      if (!area) throw new Error("Unrecognised Eircode routing key");
      geoCell = area.geoCell;
      areaLabel = area.areaLabel;
    }

    const id = await ctx.db.insert("appUsers", {
      authUserId,
      role: invite ? invite.role : "donor",
      displayName: args.displayName,
      email,
      ...(invite?.orgId ? { orgId: invite.orgId } : {}),
      ...(geoCell ? { geoCell, areaLabel } : {}),
      ...(invite ? {} : { donorReliability: 0 }),
    });
    if (invite) await ctx.db.patch(invite._id, { claimed: true });
    await ctx.db.insert("auditLog", {
      actorUserId: id,
      action: invite ? "profile.created.invited" : "profile.created.donor",
      subject: `user:${id}`,
    });
    return id;
  },
});

/** Donor updates their area (transient resolution again) or alert prefs. */
export const updateDonorSettings = mutation({
  args: {
    eircode: v.optional(v.string()),
    alertCategories: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, "donor");
    const patch: Record<string, unknown> = {};
    if (args.eircode !== undefined) {
      const area = resolveArea(args.eircode);
      if (!area) throw new Error("Unrecognised Eircode routing key");
      patch.geoCell = area.geoCell;
      patch.areaLabel = area.areaLabel;
    }
    if (args.alertCategories !== undefined) patch.alertCategories = args.alertCategories;
    await ctx.db.patch(user._id, patch);
  },
});

/** platformOps/orgAdmin issue invites (caseworkers are org-scoped). */
export const invite = mutation({
  args: {
    email: v.string(),
    role: v.union(
      v.literal("moderator"),
      v.literal("orgAdmin"),
      v.literal("caseworker"),
    ),
    orgId: v.optional(v.id("orgs")),
  },
  handler: async (ctx, args) => {
    const inviter = await requireRole(ctx, "platformOps", "orgAdmin");
    if (inviter.role === "orgAdmin") {
      if (args.role !== "caseworker") throw new Error("orgAdmin may only invite caseworkers");
      if (!inviter.orgId) throw new Error("orgAdmin has no org");
      args = { ...args, orgId: inviter.orgId };
    }
    if (args.role === "caseworker" && !args.orgId) throw new Error("caseworker invite needs an org");
    const id = await ctx.db.insert("invites", {
      email: args.email.trim().toLowerCase(),
      role: args.role,
      ...(args.orgId ? { orgId: args.orgId } : {}),
      claimed: false,
    });
    await ctx.db.insert("auditLog", {
      actorUserId: inviter._id,
      action: `invite.${args.role}`,
      subject: `invite:${id}`,
    });
    return id;
  },
});
