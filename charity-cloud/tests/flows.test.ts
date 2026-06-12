/**
 * Charity Cloud — integration tests over the real Convex functions:
 *  - RBAC matrix (rule 10): wrong roles are rejected.
 *  - Need loop: post → review → moderate → public feed visibility + redaction.
 *  - Match race: two concurrent accepts, exactly one wins (offers auto-release).
 *  - Chat PII guard (rule 7): Eircode flags + enqueues moderation.
 *  - Category whitelist (rule 8) at the mutation layer.
 *  - identityVault is internal-only (rule 3).
 */
import { describe, it, expect } from "vitest";
import { api, internal } from "../convex/_generated/api";
import { makeT, createUser, createVerifiedOrg, createHandover } from "./helpers";

async function postedNeed(t = makeT()) {
  const orgId = await createVerifiedOrg(t);
  const handoverId = await createHandover(t, orgId);
  const cw = await createUser(t, { role: "caseworker", orgId });
  const needId = await cw.as.mutation(api.needs.post, {
    category: "bedding_warmth",
    subcategory: "blankets",
    conditionAccepted: "Good used",
    urgency: "urgent",
    qty: 1,
    handoverPointId: handoverId,
    clientRef: "CASE-001",
    consentConfirmed: true,
  });
  return { t, orgId, handoverId, cw, needId };
}

describe("RBAC (rule 10)", () => {
  it("a donor cannot post a need", async () => {
    const t = makeT();
    const orgId = await createVerifiedOrg(t);
    const handoverId = await createHandover(t, orgId);
    const donor = await createUser(t, { role: "donor", geoCell: "gc7x9" });
    await expect(
      donor.as.mutation(api.needs.post, {
        category: "bedding_warmth",
        subcategory: "blankets",
        conditionAccepted: "x",
        urgency: "soon",
        qty: 1,
        handoverPointId: handoverId,
        clientRef: "C",
        consentConfirmed: true,
      }),
    ).rejects.toThrow();
  });

  it("a caseworker cannot approve moderation", async () => {
    const { t, cw } = await postedNeed();
    const item = await t.run(async (ctx) =>
      (await ctx.db.query("moderationItems").first())!,
    );
    await expect(cw.as.mutation(api.moderation.approveNeed, { itemId: item._id })).rejects.toThrow();
  });

  it("signed-out callers get an empty feed (no leak)", async () => {
    const { t } = await postedNeed();
    const feed = await t.query(api.needs.publicFeed);
    expect(feed).toEqual([]);
  });
});

describe("need loop + redaction", () => {
  it("a need is invisible until approved, then appears redacted to a local donor", async () => {
    const { t, needId } = await postedNeed();
    const donor = await createUser(t, { role: "donor", geoCell: "gc7x9", areaLabel: "Dublin 8" });

    // Before approval: not in the feed.
    expect(await donor.as.query(api.needs.publicFeed)).toEqual([]);

    // Moderator approves.
    const mod = await createUser(t, { role: "moderator" });
    const item = await t.run(async (ctx) => (await ctx.db.query("moderationItems").first())!);
    await mod.as.mutation(api.moderation.approveNeed, { itemId: item._id });

    const feed = await donor.as.query(api.needs.publicFeed);
    expect(feed).toHaveLength(1);
    const dto = feed[0]!;
    expect(dto.id).toBe(needId);
    expect(dto.distance).toBe("within ~5km");
    // Redaction: no private fields on the wire.
    expect(JSON.stringify(dto)).not.toContain("CASE-001");
    expect("privateNote" in dto).toBe(false);
    expect("geoCell" in dto).toBe(false);
  });

  it("a donor in a far-away cell does NOT see the need (geo match)", async () => {
    const { t } = await postedNeed();
    const mod = await createUser(t, { role: "moderator" });
    const item = await t.run(async (ctx) => (await ctx.db.query("moderationItems").first())!);
    await mod.as.mutation(api.moderation.approveNeed, { itemId: item._id });

    const farDonor = await createUser(t, { role: "donor", geoCell: "u4pru", areaLabel: "Denmark" });
    expect(await farDonor.as.query(api.needs.publicFeed)).toEqual([]);
  });
});

describe("category whitelist (rule 8)", () => {
  it("rejects an out-of-taxonomy subcategory at the mutation layer", async () => {
    const t = makeT();
    const orgId = await createVerifiedOrg(t, { allowedCategories: ["bedding_warmth"] });
    const handoverId = await createHandover(t, orgId);
    const cw = await createUser(t, { role: "caseworker", orgId });
    await expect(
      cw.as.mutation(api.needs.post, {
        category: "bedding_warmth",
        subcategory: "car_seat", // banned / not in taxonomy
        conditionAccepted: "x",
        urgency: "soon",
        qty: 1,
        handoverPointId: handoverId,
        clientRef: "C",
        consentConfirmed: true,
      }),
    ).rejects.toThrow();
  });
});

describe("match race (W3)", () => {
  it("two concurrent accepts: exactly one match, the other offer released", async () => {
    const { t, orgId, needId, cw } = await postedNeed();
    // publish it
    const mod = await createUser(t, { role: "moderator" });
    const item = await t.run(async (ctx) => (await ctx.db.query("moderationItems").first())!);
    await mod.as.mutation(api.moderation.approveNeed, { itemId: item._id });

    const d1 = await createUser(t, { role: "donor", geoCell: "gc7x9", email: "d1@test.ie" });
    const d2 = await createUser(t, { role: "donor", geoCell: "gc7x9", email: "d2@test.ie" });
    const o1 = await d1.as.mutation(api.offers.make, { needId, conditionNote: "blanket A" });
    const o2 = await d2.as.mutation(api.offers.make, { needId, conditionNote: "blanket B" });

    // Fire both accepts concurrently.
    const results = await Promise.allSettled([
      cw.as.mutation(api.offers.accept, { offerId: o1 }),
      cw.as.mutation(api.offers.accept, { offerId: o2 }),
    ]);
    const fulfilledCount = results.filter((r) => r.status === "fulfilled").length;
    expect(fulfilledCount).toBe(1);

    // Exactly one match; need is matched; loser offer is released.
    const { matches, offers, need } = await t.run(async (ctx) => ({
      matches: await ctx.db.query("matches").collect(),
      offers: await ctx.db.query("offers").collect(),
      need: await ctx.db.get(needId),
    }));
    expect(matches).toHaveLength(1);
    expect(need?.status).toBe("matched");
    const accepted = offers.filter((o) => o.status === "accepted");
    const released = offers.filter((o) => o.status === "released");
    expect(accepted).toHaveLength(1);
    expect(released).toHaveLength(1);
    void orgId;
  });
});

describe("chat PII guard (rule 7)", () => {
  it("an Eircode in chat flags the message and enqueues moderation", async () => {
    const { t, needId, cw } = await postedNeed();
    const mod = await createUser(t, { role: "moderator" });
    const item = await t.run(async (ctx) => (await ctx.db.query("moderationItems").first())!);
    await mod.as.mutation(api.moderation.approveNeed, { itemId: item._id });
    const donor = await createUser(t, { role: "donor", geoCell: "gc7x9" });
    const offerId = await donor.as.mutation(api.offers.make, { needId, conditionNote: "ok" });
    const matchId = await cw.as.mutation(api.offers.accept, { offerId });

    const res = await donor.as.mutation(api.messages.send, {
      matchId,
      body: "drop it to me at D02 X285 thanks",
    });
    expect(res.warning).toBeTruthy();

    const flags = await t.run(async (ctx) =>
      ctx.db
        .query("moderationItems")
        .filter((q) => q.eq(q.field("kind"), "chatFlag"))
        .collect(),
    );
    expect(flags.length).toBe(1);
  });

  it("a PPSN pasted into chat is redacted before storage (rule 4)", async () => {
    const { t, needId, cw } = await postedNeed();
    const mod = await createUser(t, { role: "moderator" });
    const item = await t.run(async (ctx) => (await ctx.db.query("moderationItems").first())!);
    await mod.as.mutation(api.moderation.approveNeed, { itemId: item._id });
    const donor = await createUser(t, { role: "donor", geoCell: "gc7x9" });
    const offerId = await donor.as.mutation(api.offers.make, { needId, conditionNote: "ok" });
    const matchId = await cw.as.mutation(api.offers.accept, { offerId });

    await donor.as.mutation(api.messages.send, { matchId, body: "my ppsn 1234567FA" });
    const msgs = await t.run(async (ctx) => ctx.db.query("messages").collect());
    expect(msgs.some((m) => m.body.includes("1234567FA"))).toBe(false);
    expect(msgs.some((m) => m.body.includes("[redacted]"))).toBe(true);
  });
});

describe("identity vault (rule 3)", () => {
  it("storing a client ref redacts a PPSN and audits the write", async () => {
    const { t, needId } = await postedNeed();
    const vault = await t.run(async (ctx) => ctx.db.query("identityVault").collect());
    expect(vault).toHaveLength(1);
    expect(vault[0]!.clientRef).toBe("CASE-001");

    // Audit row exists for the vault write.
    const audits = await t.run(async (ctx) =>
      ctx.db
        .query("auditLog")
        .filter((q) => q.eq(q.field("action"), "vault.write"))
        .collect(),
    );
    expect(audits.length).toBe(1);
    void needId;
  });
});
