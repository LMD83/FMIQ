/**
 * Charity Cloud — test helpers: spin up convex-test and create users with a
 * given role/org, returning an identity-bound test client.
 */
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import type { Id } from "../convex/_generated/dataModel";

export type T = ReturnType<typeof convexTest>;
export type Role = "platformOps" | "moderator" | "orgAdmin" | "caseworker" | "donor";

export function makeT(): T {
  return convexTest(schema);
}

/** Create an auth user + appUsers profile; return its ids and an identity client. */
export async function createUser(
  t: T,
  opts: { role: Role; orgId?: Id<"orgs">; geoCell?: string; areaLabel?: string; email?: string },
) {
  const { authUserId, appUserId } = await t.run(async (ctx) => {
    const authUserId = await ctx.db.insert("users", { name: opts.role });
    const appUserId = await ctx.db.insert("appUsers", {
      authUserId,
      role: opts.role,
      displayName: opts.role,
      email: opts.email ?? `${opts.role}@test.ie`,
      ...(opts.orgId ? { orgId: opts.orgId } : {}),
      ...(opts.geoCell ? { geoCell: opts.geoCell, areaLabel: opts.areaLabel ?? "Area" } : {}),
      ...(opts.role === "donor" ? { donorReliability: 0 } : {}),
    });
    return { authUserId, appUserId };
  });
  // getAuthUserId() reads identity.subject and returns the part before "|".
  const as = t.withIdentity({ subject: authUserId });
  return { authUserId, appUserId, as };
}

export async function createVerifiedOrg(
  t: T,
  opts?: { allowedCategories?: string[]; purpose?: string },
): Promise<Id<"orgs">> {
  return await t.run(async (ctx) =>
    ctx.db.insert("orgs", {
      name: "Test Org",
      rcn: "20000001",
      status: "verified",
      purposeCategory: opts?.purpose ?? "homelessness",
      allowedCategories: opts?.allowedCategories ?? ["bedding_warmth", "clothing"],
      registerCheckedAt: Date.now(),
    }),
  );
}

export async function createHandover(t: T, orgId: Id<"orgs">): Promise<Id<"handoverPoints">> {
  return await t.run(async (ctx) =>
    ctx.db.insert("handoverPoints", {
      orgId,
      label: "Test Centre",
      areaLabel: "Dublin 8",
      geoCell: "gc7x9",
      active: true,
    }),
  );
}
