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
  OpwFloodProvider,
  GsiGeologyProvider,
  MyPlanZoningProvider,
  NpwsEcologyProvider,
  HeritageProvider,
  CustomerSuppliedGeocoder,
  geoFinding,
  isHighRadon,
  floodZone,
  adverseGround,
  zoningObjective,
  designatedSite,
  recordedMonument,
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

  it("rejects a non-finite coordinate before building a query", () => {
    expect(() => new EpaRadonProvider().buildUrl({ x: Number.NaN, y: 1 })).toThrow(/Invalid ITM/);
    expect(() => new EpaRadonProvider().buildUrl({ x: 1, y: Infinity })).toThrow(/Invalid ITM/);
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

describe("OPW flood provider", () => {
  it("resolves a site in a flood extent → a High-risk FRA finding", async () => {
    const provider = new OpwFloodProvider(fakeFetch({ features: [{ attributes: { Flood_Zone: "Zone A" } }] }));
    const result = await provider.query(SITE);
    expect(result.status).toBe("resolved");
    expect(result.flagged).toBe(true);

    const f = geoFinding(result)!;
    expect(f.requirement).toMatch(/Flood Risk Management/);
    expect(f.risk).toBe("High");
    expect(f.required_evidence[0]).toMatch(/Flood Risk Assessment/);
  });

  it("resolves a site outside any mapped extent → no finding", async () => {
    const provider = new OpwFloodProvider(fakeFetch({ features: [] }));
    const result = await provider.query(SITE);
    expect(result.flagged).toBeUndefined();
    expect(geoFinding(result)).toBeNull();
  });

  it("degrades to a request-from-OPW finding when unreachable", async () => {
    const provider = new OpwFloodProvider(async () => {
      throw new Error("network");
    });
    const result = await provider.query(SITE);
    expect(result.status).toBe("manual-request-required");
    expect(result.requestFrom).toMatch(/OPW/);
  });

  it("floodZone reads varied attribute shapes", () => {
    expect(floodZone({ Flood_Zone: "Zone A" })).toBe("A");
    expect(floodZone({ Flood_Zone: "Zone B (moderate)" })).toBe("B");
    expect(floodZone({ AEP: 0.01 })).toBe("A");
    expect(floodZone({ AEP: 0.001 })).toBe("B");
  });
});

describe("GSI geology provider", () => {
  it("resolves adverse ground → a ground-investigation finding", async () => {
    const provider = new GsiGeologyProvider(fakeFetch({ features: [{ attributes: { SUBSOIL: "Peat" } }] }));
    const result = await provider.query(SITE);
    expect(result.status).toBe("resolved");
    expect(result.flagged).toBe(true);

    const f = geoFinding(result)!;
    expect(f.requirement).toMatch(/Eurocode 7/);
    expect(f.required_evidence[0]).toMatch(/ground investigation/i);
  });

  it("resolves benign ground → no finding", async () => {
    const provider = new GsiGeologyProvider(fakeFetch({ features: [{ attributes: { SUBSOIL: "Till" } }] }));
    const result = await provider.query(SITE);
    expect(result.flagged).toBe(false);
    expect(geoFinding(result)).toBeNull();
  });

  it("adverseGround detects peat, landslide and karst", () => {
    expect(adverseGround({ SUBSOIL: "Peat" })).toMatch(/Peat/);
    expect(adverseGround({ HAZARD: "Landslide susceptibility — high" })).toMatch(/Landslide/);
    expect(adverseGround({ FEATURE: "Karst" })).toMatch(/Karst/);
    expect(adverseGround({ SUBSOIL: "Till" })).toBeNull();
  });
});

describe("MyPlan zoning provider", () => {
  it("surfaces a zoning objective → a consistency Clarification finding", async () => {
    const provider = new MyPlanZoningProvider(
      fakeFetch({ features: [{ attributes: { ZONE_DESC: "Residential (Existing)" } }] }),
    );
    const result = await provider.query(SITE);
    expect(result.flagged).toBe(true);

    const f = geoFinding(result)!;
    expect(f.status).toBe("Clarification required");
    expect(f.requirement).toMatch(/zoning objective/);
    expect(result.summary).toMatch(/Residential/);
  });

  it("returns no finding when no zoning is mapped", async () => {
    const provider = new MyPlanZoningProvider(fakeFetch({ features: [] }));
    const result = await provider.query(SITE);
    expect(geoFinding(result)).toBeNull();
  });
});

describe("NPWS ecology provider", () => {
  it("flags a designated area → a High-risk Appropriate Assessment finding", async () => {
    const provider = new NpwsEcologyProvider(
      fakeFetch({ features: [{ attributes: { SITE_NAME: "Malahide Estuary SAC" } }] }),
    );
    const result = await provider.query(SITE);
    expect(result.flagged).toBe(true);

    const f = geoFinding(result)!;
    expect(f.risk).toBe("High");
    expect(f.requirement).toMatch(/Appropriate Assessment/);
    expect(designatedSite({ SITE_NAME: "Malahide Estuary SAC" })).toMatch(/SAC/);
  });

  it("returns no finding when no designation is mapped", async () => {
    const provider = new NpwsEcologyProvider(fakeFetch({ features: [] }));
    expect(geoFinding(await provider.query(SITE))).toBeNull();
  });
});

describe("Heritage provider", () => {
  it("flags a recorded monument → a High-risk statutory-notice finding", async () => {
    const provider = new HeritageProvider(
      fakeFetch({ features: [{ attributes: { CLASSDESC: "Ringfort - rath" } }] }),
    );
    const result = await provider.query(SITE);
    expect(result.flagged).toBe(true);

    const f = geoFinding(result)!;
    expect(f.risk).toBe("High");
    expect(f.requirement).toMatch(/National Monuments Acts/);
    expect(recordedMonument({ CLASSDESC: "Ringfort - rath" })).toMatch(/Ringfort/);
  });

  it("degrades to a request-from finding when unreachable", async () => {
    const provider = new HeritageProvider(async () => {
      throw new Error("network");
    });
    const result = await provider.query(SITE);
    expect(result.status).toBe("manual-request-required");
    expect(result.requestFrom).toMatch(/National Monuments/);
  });

  it("zoningObjective ignores non-zoning fields", () => {
    expect(zoningObjective({ OBJECTID: 1, ZONE_DESC: "Open Space" })).toBe("Open Space");
    expect(zoningObjective({ OBJECTID: 1 })).toBeNull();
  });
});

describe("CustomerSuppliedGeocoder", () => {
  it("returns the supplied coordinate, or null when absent", async () => {
    expect(await new CustomerSuppliedGeocoder(SITE).resolve()).toEqual(SITE);
    expect(await new CustomerSuppliedGeocoder(null).resolve()).toBeNull();
  });
});
