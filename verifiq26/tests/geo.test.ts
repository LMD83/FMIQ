/**
 * VerifIQ — geospatial adapter tests (Phase 5).
 *
 * Exercises the EPA radon provider (ArcGIS query URL + response parsing) with an
 * injected fetcher — no network — and the result→Finding mapping incl. graceful
 * degradation (gated layer → "request from X" finding).
 *
 * Version: 0.8.0-phase5
 */

import { describe, it, expect } from "vitest";
import {
  EpaRadonProvider,
  CustomerSuppliedGeocoder,
  geoFinding,
  isHighRadon,
  type FetchJson,
  type ItmCoordinate,
} from "../src/geo/index.js";

const SITE: ItmCoordinate = { x: 715000, y: 748000 }; // ~Swords

const fakeFetch =
  (json: unknown): FetchJson =>
  async () =>
    json;

describe("EPA radon provider", () => {
  it("builds an ArcGIS point-intersect query URL in ITM", () => {
    const url = new EpaRadonProvider().buildUrl(SITE);
    expect(url).toContain("RadiologicalProtection/MapServer/1/query");
    expect(url).toContain("geometry=715000%2C748000");
    expect(url).toContain("inSR=2157");
    expect(url).toContain("geometryType=esriGeometryPoint");
    expect(url).toContain("f=json");
  });

  it("resolves a High Radon Area → a TGD C finding", async () => {
    const provider = new EpaRadonProvider(fakeFetch({ features: [{ attributes: { HighRadonArea: "Yes" } }] }));
    const result = await provider.query(SITE);
    expect(result.status).toBe("resolved");
    expect(result.flagged).toBe(true);

    const f = geoFinding(result)!;
    expect(f.requirement).toMatch(/TGD C/);
    expect(f.required_evidence[0]).toMatch(/radon-resisting membrane/);
    expect(f.discipline_origin).toBe("Geospatial / Site Constraints");
  });

  it("resolves a non-High-Radon site → no finding", async () => {
    const provider = new EpaRadonProvider(fakeFetch({ features: [{ attributes: { HighRadonArea: "No" } }] }));
    const result = await provider.query(SITE);
    expect(result.flagged).toBe(false);
    expect(geoFinding(result)).toBeNull();
  });

  it("degrades gracefully when the layer is unreachable → request-from finding", async () => {
    const provider = new EpaRadonProvider(async () => {
      throw new Error("network");
    });
    const result = await provider.query(SITE);
    expect(result.status).toBe("manual-request-required");
    expect(result.requestFrom).toMatch(/EPA Radon Map/);

    const f = geoFinding(result)!;
    expect(f.status).toBe("Clarification required");
    expect(f.required_evidence[0]).toMatch(/request from/i);
  });

  it("isHighRadon reads varied attribute shapes", () => {
    expect(isHighRadon({ HighRadonArea: "Yes" })).toBe(true);
    expect(isHighRadon({ PercentAboveReference: 15 })).toBe(true);
    expect(isHighRadon({ HighRadonArea: "No" })).toBe(false);
    expect(isHighRadon({ unrelated: "value" })).toBe(false);
  });
});

describe("CustomerSuppliedGeocoder", () => {
  it("returns the supplied coordinate, or null when absent", async () => {
    expect(await new CustomerSuppliedGeocoder(SITE).resolve()).toEqual(SITE);
    expect(await new CustomerSuppliedGeocoder(null).resolve()).toBeNull();
  });
});
