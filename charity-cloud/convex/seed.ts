/**
 * Charity Cloud — pilot seed data (Sprint 6 item 3, pulled forward for demo).
 *
 * Creates verified orgs + handover points + role INVITES. Auth accounts are
 * created by signing up in the app (or the smoke script) with the invited
 * email — the invite assigns the role at first sign-in (users.ensureProfile).
 *
 * Run: npx convex run seed:run
 */
import { internalMutation } from "./_generated/server";
import { resolveArea } from "../packages/shared/src/index";

function area(routingKey: string): { areaLabel: string; geoCell: string } {
  const resolved = resolveArea(routingKey);
  if (!resolved) throw new Error(`seed: unknown routing key ${routingKey}`);
  return resolved;
}

export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("orgs").collect();
    if (existing.length > 0) return "already seeded";

    const simon = await ctx.db.insert("orgs", {
      name: "Dublin Simon Outreach (demo)",
      rcn: "20067890",
      status: "verified",
      purposeCategory: "homelessness",
      allowedCategories: [
        "bedding_warmth",
        "clothing",
        "kitchen_household",
        "outdoor_camping",
        "furniture",
      ],
      registerCheckedAt: Date.now(),
    });
    const brigids = await ctx.db.insert("orgs", {
      name: "St. Brigid's Family Support (demo)",
      rcn: "20012345",
      status: "verified",
      purposeCategory: "family_support",
      allowedCategories: ["baby_child", "clothing", "furniture", "kitchen_household", "education_school"],
      registerCheckedAt: Date.now(),
    });

    await ctx.db.insert("handoverPoints", {
      orgId: simon,
      label: "Capuchin Day Centre, front desk",
      ...area("D07"),
      active: true,
    });
    await ctx.db.insert("handoverPoints", {
      orgId: simon,
      label: "Merchants Quay drop-in",
      ...area("D08"),
      active: true,
    });
    await ctx.db.insert("handoverPoints", {
      orgId: brigids,
      label: "St. Brigid's Centre, Tallaght reception",
      ...area("D24"),
      active: true,
    });

    // Role invites — sign up with these emails to claim the role.
    const invites: Array<{ email: string; role: "platformOps" | "moderator" | "orgAdmin" | "caseworker"; orgId?: typeof simon }> = [
      { email: "ops@demo.ie", role: "platformOps" },
      { email: "mod@demo.ie", role: "moderator" },
      { email: "admin@simon.demo.ie", role: "orgAdmin", orgId: simon },
      { email: "cw@simon.demo.ie", role: "caseworker", orgId: simon },
      { email: "admin@brigids.demo.ie", role: "orgAdmin", orgId: brigids },
      { email: "cw@brigids.demo.ie", role: "caseworker", orgId: brigids },
    ];
    for (const inv of invites) {
      await ctx.db.insert("invites", {
        email: inv.email,
        role: inv.role,
        ...(inv.orgId ? { orgId: inv.orgId } : {}),
        claimed: false,
      });
    }
    await ctx.db.insert("auditLog", { action: "seed.run", subject: "seed" });
    return "seeded: 2 orgs, 3 handover points, 6 role invites";
  },
});
