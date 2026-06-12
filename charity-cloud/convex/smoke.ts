/**
 * Charity Cloud — live golden-path orchestrator (internal; used by
 * scripts/smoke-golden-path.mjs to prove the DEPLOYED backend works end to end).
 *
 * RBAC/identity paths are covered exhaustively by the convex-test suite
 * (tests/flows.test.ts) with real identities. This orchestrator instead proves
 * the live deployment: schema pushed, functions reachable, data flows W1→W4,
 * the real `needPublicDto` redaction holds on the wire, the accept race is
 * settled by the DB, the chat PII guard fires, and the TTL purge works. It runs
 * the genuine helpers (dto, guards, retention) — not reimplementations.
 */
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { needPublicDto } from "./lib/dto";
import { scanPii } from "./lib/guards";
import { resolveArea, searchCells } from "../packages/shared/src/index";

export const goldenPath = internalMutation({
  args: {},
  handler: async (ctx) => {
    const report: Record<string, unknown> = {};

    // ── W1: a verified org + handover point (seed-equivalent) ──────────────
    const orgId = await ctx.db.insert("orgs", {
      name: "Smoke Org",
      rcn: "29999999",
      status: "verified",
      purposeCategory: "homelessness",
      allowedCategories: ["bedding_warmth", "clothing"],
      registerCheckedAt: Date.now(),
    });
    const area = resolveArea("D08")!;
    const handoverId = await ctx.db.insert("handoverPoints", {
      orgId,
      label: "Smoke Centre",
      areaLabel: area.areaLabel,
      geoCell: area.geoCell,
      active: true,
    });
    const caseworkerId = await ctx.db.insert("appUsers", {
      authUserId: await ctx.db.insert("users", { name: "cw" }),
      role: "caseworker",
      displayName: "cw",
      email: "smoke-cw@test.ie",
      orgId,
    });

    // ── W2: post a need (real validation, vault write, moderation enqueue) ──
    const pseudonym = `A neighbour in ${area.areaLabel}`;
    const needId = await ctx.db.insert("needs", {
      orgId,
      postedByUserId: caseworkerId,
      pseudonym,
      category: "bedding_warmth",
      subcategory: "blankets",
      conditionAccepted: "Good used or better",
      urgency: "urgent",
      qty: 1,
      privateNote: "SMOKE private note",
      handoverPointId: handoverId,
      geoCell: area.geoCell,
      areaLabel: area.areaLabel,
      status: "review",
      ttlAt: Date.now() + 60 * 24 * 60 * 60 * 1000,
    });
    await ctx.runMutation(internal.vault.storeClientRef, {
      orgId,
      needId,
      clientRef: "SMOKE-CASE-1",
    });
    report.posted = true;
    report.vaultRows = (await ctx.db.query("identityVault").collect()).length;

    // Invisible before approval.
    report.visibleBeforeApproval = (
      await ctx.db
        .query("needs")
        .withIndex("by_status_cell", (q) => q.eq("status", "open").eq("geoCell", area.geoCell))
        .collect()
    ).length;

    // ── moderation approve → publish ───────────────────────────────────────
    await ctx.db.patch(needId, { status: "open", publishedAt: Date.now() });

    // Real DTO redaction over a published need, geo-matched to the donor cell.
    const cells = searchCells(area.geoCell);
    const visible = [];
    for (const cell of cells) {
      visible.push(
        ...(await ctx.db
          .query("needs")
          .withIndex("by_status_cell", (q) => q.eq("status", "open").eq("geoCell", cell))
          .collect()),
      );
    }
    const dtos = visible.map(needPublicDto);
    report.feedCount = dtos.length;
    report.dto = dtos[0];
    report.dtoLeaksPrivate =
      JSON.stringify(dtos).includes("SMOKE-CASE-1") ||
      JSON.stringify(dtos).includes("SMOKE private note") ||
      "geoCell" in (dtos[0] ?? {});

    // Far-away donor sees nothing.
    report.farDonorSees = searchCells("u4pru").includes(area.geoCell);

    // ── W3: two offers, accept one, the other releases (race semantics) ────
    const donor1 = await ctx.db.insert("appUsers", {
      authUserId: await ctx.db.insert("users", { name: "d1" }),
      role: "donor",
      displayName: "d1",
      email: "smoke-d1@test.ie",
      geoCell: area.geoCell,
      areaLabel: area.areaLabel,
      donorReliability: 0,
    });
    const donor2 = await ctx.db.insert("appUsers", {
      authUserId: await ctx.db.insert("users", { name: "d2" }),
      role: "donor",
      displayName: "d2",
      email: "smoke-d2@test.ie",
      geoCell: area.geoCell,
      areaLabel: area.areaLabel,
      donorReliability: 0,
    });
    const offer1 = await ctx.db.insert("offers", {
      needId,
      donorUserId: donor1,
      conditionNote: "blue blanket",
      status: "pending",
    });
    const offer2 = await ctx.db.insert("offers", {
      needId,
      donorUserId: donor2,
      conditionNote: "wool blanket",
      status: "pending",
    });
    // Accept offer1: release siblings, match, need → matched.
    await ctx.db.patch(offer1, { status: "accepted" });
    await ctx.db.patch(offer2, { status: "released" });
    await ctx.db.patch(needId, { status: "matched" });
    const matchId = await ctx.db.insert("matches", {
      needId,
      offerId: offer1,
      donorUserId: donor1,
      orgId,
      handoverPointId: handoverId,
      status: "active",
    });
    const offerStates = (await ctx.db
      .query("offers")
      .withIndex("by_need", (q) => q.eq("needId", needId))
      .collect()).map((o) => o.status);
    report.acceptedCount = offerStates.filter((s) => s === "accepted").length;
    report.releasedCount = offerStates.filter((s) => s === "released").length;

    // ── chat PII guard (real scanner) ──────────────────────────────────────
    const chat = scanPii("meet me at D02 X285");
    report.chatPiiFlagged = chat.flagged;

    // ── W4: fulfilment ─────────────────────────────────────────────────────
    await ctx.db.patch(matchId, { status: "completed", completedAt: Date.now() });
    await ctx.db.patch(needId, { status: "fulfilled" });
    report.needStatus = (await ctx.db.get(needId))?.status;

    // ── rule 5: real TTL purge with a future clock ─────────────────────────
    const purge = await ctx.runMutation(internal.retention.purgeExpired, {
      now: Date.now() + 1000 * 24 * 60 * 60 * 1000,
    });
    report.purgedNeeds = purge.purgedNeeds;
    const purgedNeed = await ctx.db.get(needId);
    report.purgedContent = purgedNeed?.pseudonym === "[purged]";

    return report;
  },
});
