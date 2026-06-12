/**
 * Charity Cloud — TTL purge proof (rule 5) with an injected clock.
 */
import { describe, it, expect } from "vitest";
import { internal } from "../convex/_generated/api";
import { makeT, createVerifiedOrg, createHandover, createUser } from "./helpers";
import { api } from "../convex/_generated/api";

describe("retention purge", () => {
  it("replaces expired need content with [purged] and keeps a stats row", async () => {
    const t = makeT();
    const orgId = await createVerifiedOrg(t);
    const handoverId = await createHandover(t, orgId);
    const cw = await createUser(t, { role: "caseworker", orgId });
    const needId = await cw.as.mutation(api.needs.post, {
      category: "bedding_warmth",
      subcategory: "blankets",
      conditionAccepted: "Good used",
      urgency: "soon",
      qty: 1,
      handoverPointId: handoverId,
      clientRef: "CASE-XYZ",
      consentConfirmed: true,
    });

    // Run purge with a clock far in the future (past every ttlAt).
    const future = Date.now() + 1000 * 24 * 60 * 60 * 1000;
    const result = await t.mutation(internal.retention.purgeExpired, { now: future });
    expect(result.purgedNeeds).toBe(1);

    const need = await t.run(async (ctx) => ctx.db.get(needId));
    expect(need?.status).toBe("purged");
    expect(need?.pseudonym).toBe("[purged]");
    expect(need?.privateNote ?? null).toBeNull();

    const stats = await t.run(async (ctx) => ctx.db.query("purgeStats").collect());
    expect(stats).toHaveLength(1);
    expect(stats[0]!.purgedCount).toBe(1);
    expect(stats[0]!.category).toBe("bedding_warmth");
  });

  it("does not purge needs that are still within TTL", async () => {
    const t = makeT();
    const orgId = await createVerifiedOrg(t);
    const handoverId = await createHandover(t, orgId);
    const cw = await createUser(t, { role: "caseworker", orgId });
    await cw.as.mutation(api.needs.post, {
      category: "bedding_warmth",
      subcategory: "blankets",
      conditionAccepted: "Good used",
      urgency: "soon",
      qty: 1,
      handoverPointId: handoverId,
      clientRef: "CASE-XYZ",
      consentConfirmed: true,
    });
    const result = await t.mutation(internal.retention.purgeExpired, { now: Date.now() });
    expect(result.purgedNeeds).toBe(0);
  });
});
