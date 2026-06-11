import { getAuthUserId } from "@convex-dev/auth/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

type AuthCtx = QueryCtx | MutationCtx;

/** Returns the authenticated Convex Auth user id, or throws. */
export async function requireAuthUserId(ctx: AuthCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Not authenticated");
  }
  return userId;
}

/** Returns the authenticated user's email when available. */
export async function requireAuthEmail(ctx: AuthCtx): Promise<string> {
  const userId = await requireAuthUserId(ctx);
  const user = await ctx.db.get(userId);
  if (!user?.email) {
    throw new Error("Authenticated user has no email");
  }
  return user.email;
}
