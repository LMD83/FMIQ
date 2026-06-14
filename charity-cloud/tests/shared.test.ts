/**
 * Charity Cloud — shared package tests: geohash known vectors, neighbour math,
 * taxonomy whitelist, banned list, PII regexes.
 */
import { describe, it, expect } from "vitest";
import {
  encodeGeohash,
  decodeGeohash,
  adjacentCell,
  neighbourCells,
  searchCells,
  isAllowedCategory,
  CATEGORIES,
  TAXONOMY,
  BANNED_ITEMS,
  PURPOSE_TO_CATEGORIES,
  scanPii,
  redactPpsn,
} from "../packages/shared/src/index.ts";

describe("geohash encode (known vectors)", () => {
  // Published vectors (geohash.org / Wikipedia)
  it("encodes ezs42 (42.605, -5.603 @ p5)", () => {
    expect(encodeGeohash(42.605, -5.603, 5)).toBe("ezs42");
  });
  it("encodes u4pruydqqvj (57.64911, 10.40744 @ p11)", () => {
    expect(encodeGeohash(57.64911, 10.40744, 11)).toBe("u4pruydqqvj");
  });
  it("encodes Dublin city centre (53.3498, -6.2603) to gc7x9", () => {
    expect(encodeGeohash(53.3498, -6.2603, 5)).toBe("gc7x9");
  });
  it("round-trips: decode is inside the encoded cell", () => {
    const { lat, lon } = decodeGeohash("gc7x3");
    expect(encodeGeohash(lat, lon, 5)).toBe("gc7x3");
  });
  it("rejects out-of-range input", () => {
    expect(() => encodeGeohash(91, 0)).toThrow();
    expect(() => encodeGeohash(0, 181)).toThrow();
  });
});

describe("geohash neighbours", () => {
  it("8 neighbours of gc7x3 are distinct, valid, and exclude the centre", () => {
    const n = neighbourCells("gc7x3");
    expect(n).toHaveLength(8);
    expect(new Set(n).size).toBe(8);
    expect(n).not.toContain("gc7x3");
    for (const cell of n) expect(cell).toHaveLength(5);
  });
  it("adjacency is symmetric (n of s is self)", () => {
    const south = adjacentCell("gc7x3", "s");
    expect(adjacentCell(south, "n")).toBe("gc7x3");
    const east = adjacentCell("gc7x3", "e");
    expect(adjacentCell(east, "w")).toBe("gc7x3");
  });
  it("neighbours of every neighbour include the original (grid coherence)", () => {
    for (const cell of neighbourCells("gc7x3")) {
      expect(searchCells(cell)).toContain("gc7x3");
    }
  });
  it("searchCells = centre + 8", () => {
    const s = searchCells("gc7x3");
    expect(s).toHaveLength(9);
    expect(s[0]).toBe("gc7x3");
  });
});

describe("taxonomy", () => {
  it("has exactly 8 top categories and 35–45 subcategories", () => {
    expect(CATEGORIES).toHaveLength(8);
    const subCount = CATEGORIES.reduce(
      (acc, c) => acc + Object.keys(TAXONOMY[c].subcategories).length,
      0,
    );
    expect(subCount).toBeGreaterThanOrEqual(35);
    expect(subCount).toBeLessThanOrEqual(45);
  });
  it("whitelists valid pairs and rejects everything else", () => {
    expect(isAllowedCategory("mobility_equipment", "wheelchair")).toBe(true);
    expect(isAllowedCategory("mobility_equipment", "car_seat")).toBe(false);
    expect(isAllowedCategory("not_a_category", "wheelchair")).toBe(false);
    expect(isAllowedCategory("", "")).toBe(false);
  });
  it("banned items never appear in the taxonomy (defence in depth)", () => {
    const allLabels = CATEGORIES.flatMap((c) => [
      TAXONOMY[c].label.toLowerCase(),
      ...Object.values<string>(TAXONOMY[c].subcategories).map((s) => s.toLowerCase()),
    ]);
    for (const banned of ["car seat", "cot", "helmet", "food", "blind cord"]) {
      // No taxonomy label may BE a banned item. ("Cot" must not appear as a
      // standalone word — "cotton" would be fine.)
      for (const label of allLabels) {
        expect(new RegExp(`\\b${banned}\\b`).test(label)).toBe(false);
      }
    }
    expect(BANNED_ITEMS.length).toBeGreaterThan(5);
  });
  it("purpose map only references real categories", () => {
    for (const cats of Object.values(PURPOSE_TO_CATEGORIES)) {
      for (const c of cats) expect(CATEGORIES).toContain(c);
    }
  });
});

describe("PII guards", () => {
  it("flags Eircodes", () => {
    expect(scanPii("come to D02 X285 at 6").hasEircode).toBe(true);
    expect(scanPii("meet at the library").hasEircode).toBe(false);
  });
  it("flags Irish phone numbers (mobile, geographic, +353)", () => {
    expect(scanPii("call me on 0871234567").hasPhone).toBe(true);
    expect(scanPii("ring 086 123 4567").hasPhone).toBe(true);
    expect(scanPii("+353 87 123 4567 anytime").hasPhone).toBe(true);
    expect(scanPii("01 234 5678").hasPhone).toBe(true);
    expect(scanPii("see you at 7pm").hasPhone).toBe(false);
  });
  it("flags and redacts PPSNs", () => {
    expect(scanPii("my ppsn is 1234567FA").hasPpsn).toBe(true);
    expect(redactPpsn("ppsn 1234567FA ok")).toBe("ppsn [redacted] ok");
    expect(scanPii("order #123456 is here").hasPpsn).toBe(false);
  });
  it("sets flagged on any hit", () => {
    expect(scanPii("D02 X285").flagged).toBe(true);
    expect(scanPii("hello there").flagged).toBe(false);
  });
});
