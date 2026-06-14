/**
 * Charity Cloud — RBAC (CLAUDE.md rule 10: every mutation/query begins with
 * requireRole(ctx, ...)).
 *
 * Roles: platformOps, moderator, orgAdmin, caseworker, donor.
 * Org-scoping: orgAdmin/caseworker actions are checked against their own org.
 */
import { getAuthUserId } from "@convex-dev/auth/server";
import { type Doc } from "../_generated/dataModel";
import { type MutationCtx, type QueryCtx } from "../_generated/server";

export type Role = Doc<"appUsers">["role"];
type Ctx = QueryCtx | MutationCtx;

/** The signed-in user's appUsers profile, or null when signed out / no profile. */
export async function currentUser(ctx: Ctx): Promise<Doc<"appUsers"> | null> {
  const authUserId = await getAuthUserId(ctx);
  if (authUserId === null) return null;
  return await ctx.db
    .query("appUsers")
    .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
    .unique();
}

/** Require a signed-in user with one of the given roles. Throws otherwise. */
export async function requireRole(ctx: Ctx, ...roles: Role[]): Promise<Doc<"appUsers">> {
  const user = await currentUser(ctx);
  if (!user) throw new Error("Not signed in (or profile missing)");
  if (!roles.includes(user.role)) {
    throw new Error(`Forbidden: requires one of [${roles.join(", ")}]`);
  }
  return user;
}

/** Require an org-scoped role AND that the user belongs to `orgId`. */
export async function requireOrgRole(
  ctx: Ctx,
  orgId: Doc<"orgs">["_id"],
  ...roles: Role[]
): Promise<Doc<"appUsers">> {
  const user = await requireRole(ctx, ...roles);
  if (user.orgId !== orgId) throw new Error("Forbidden: wrong organisation");
  return user;
}
