/**
 * Charity Cloud — privacy contract tests (CLAUDE.md rules 1, 2, 9).
 *
 * The DTO snapshot is the privacy contract: it asserts the EXACT field set the
 * public feed exposes. If a field is added to needPublicDto, this test fails on
 * purpose — forcing a conscious privacy decision. Also asserts no address/
 * coordinate field exists anywhere on persisted rows and distance is coarse.
 */
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { needPublicDto } from "../convex/lib/dto";
import type { Doc } from "../convex/_generated/dataModel";

// A fully-populated need row (every server-side field set) → DTO must drop the
// private ones. We build a plain object shaped like Doc<"needs">.
const fullNeed = {
  _id: "needs:1" as Doc<"needs">["_id"],
  _creationTime: 1,
  orgId: "orgs:1",
  postedByUserId: "appUsers:1",
  pseudonym: "A neighbour in Dublin 8",
  category: "bedding_warmth",
  subcategory: "blankets",
  conditionAccepted: "Good used or better",
  urgency: "urgent",
  qty: 2,
  privateNote: "SECRET caseworker note — must never leak",
  handoverPointId: "handoverPoints:1",
  geoCell: "gc7x9",
  areaLabel: "Dublin 8",
  status: "open",
  publishedAt: 123,
  ttlAt: 999,
} as unknown as Doc<"needs">;

describe("public need DTO (privacy contract)", () => {
  it("exposes EXACTLY this field set — no more", () => {
    const dto = needPublicDto(fullNeed);
    expect(Object.keys(dto).sort()).toEqual(
      [
        "areaLabel",
        "category",
        "conditionAccepted",
        "distance",
        "id",
        "publishedAt",
        "pseudonym",
        "qty",
        "subcategory",
        "urgency",
      ].sort(),
    );
  });

  it("never leaks privateNote, postedByUserId, orgId, geoCell, ttlAt", () => {
    const dto = needPublicDto(fullNeed) as unknown as Record<string, unknown>;
    for (const forbidden of ["privateNote", "postedByUserId", "orgId", "geoCell", "ttlAt"]) {
      expect(forbidden in dto).toBe(false);
    }
    expect(JSON.stringify(dto)).not.toContain("SECRET");
  });

  it("distance is the coarse label only — never a number (rule 9)", () => {
    expect(needPublicDto(fullNeed).distance).toBe("within ~5km");
  });

  it("matches the committed snapshot", () => {
    expect(needPublicDto(fullNeed)).toMatchInlineSnapshot(`
      {
        "areaLabel": "Dublin 8",
        "category": "bedding_warmth",
        "conditionAccepted": "Good used or better",
        "distance": "within ~5km",
        "id": "needs:1",
        "pseudonym": "A neighbour in Dublin 8",
        "publishedAt": 123,
        "qty": 2,
        "subcategory": "blankets",
        "urgency": "urgent",
      }
    `);
  });
});

describe("schema has no address/coordinate fields (rule 1)", () => {
  it("no table defines forbidden location fields", async () => {
    // Walk the schema's table validators for forbidden field names.
    const forbidden = ["address", "eircode", "lat", "lon", "latitude", "longitude", "coords"];
    const json = JSON.stringify(schema);
    for (const f of forbidden) {
      expect(json.toLowerCase().includes(`"${f}"`)).toBe(false);
    }
  });

  it("convexTest can instantiate the schema", async () => {
    const t = convexTest(schema);
    expect(t).toBeDefined();
  });
});
