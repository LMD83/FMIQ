/**
 * VerifIQ — OPW flood layer adapter (Phase 5 GeoLayerProvider).
 *
 * Queries the OPW national flood-extent data (CFRAM / NIFM, published via the
 * floodinfo.ie Open Spatial Data Portal) for whether a site falls within a
 * mapped fluvial/coastal flood extent, by ITM coordinate. Same shape as the EPA
 * radon adapter: injected fetcher, finite-coordinate guard, graceful degradation
 * to a "request from OPW" finding when the layer is unreachable.
 *
 * Anchor: The Planning System and Flood Risk Management — Guidelines for Planning
 * Authorities (DEHLG/OPW). A site in Flood Zone A/B needs a site-specific Flood
 * Risk Assessment + the Justification Test. Endpoint per docs/35 (verify live).
 *
 * Version: 0.8.0-phase5
 */

import {
  type FetchJson,
  type GeoLayerProvider,
  type GeoLayerResult,
  type ItmCoordinate,
  defaultFetchJson,
} from "./types.js";
import { buildPointQueryUrl, firstFeatureAttributes } from "./arcgis.js";

const ENDPOINT =
  "https://gis.floodinfo.ie/arcgis/rest/services/OPWHydro/CFRAM_Fluvial_Coastal_Flood_Extents/MapServer/0/query";

export class OpwFloodProvider implements GeoLayerProvider {
  readonly layer = "flood";
  constructor(private readonly fetchJson: FetchJson = defaultFetchJson) {}

  /** Build the ArcGIS point-intersect query URL for a coordinate. */
  buildUrl(coord: ItmCoordinate): string {
    return buildPointQueryUrl(ENDPOINT, coord);
  }

  async query(coord: ItmCoordinate): Promise<GeoLayerResult> {
    let json: unknown;
    try {
      json = await this.fetchJson(this.buildUrl(coord));
    } catch {
      return {
        layer: this.layer,
        status: "manual-request-required",
        summary: "OPW flood layer not reachable — confirm the flood zone manually.",
        requestFrom: "OPW Flood Maps (floodinfo.ie); bespoke models flood_data@opw.ie",
      };
    }

    const attributes = firstFeatureAttributes(json);
    if (!attributes) {
      return {
        layer: this.layer,
        status: "resolved",
        summary: "Site is not within a mapped OPW flood extent (Flood Zone C).",
      };
    }
    const zone = floodZone(attributes);
    const flagged = zone === "A" || zone === "B";
    return {
      layer: this.layer,
      status: "resolved",
      flagged,
      summary: flagged
        ? `Site is within a mapped flood extent (Flood Zone ${zone}) — a site-specific Flood Risk Assessment applies.`
        : "Site is not within a mapped OPW flood extent.",
      attributes,
    };
  }
}

/**
 * Read the flood zone from feature attributes (field names vary across the CFRAM
 * / NIFM layers). Returns "A" (high probability), "B" (moderate), or null.
 */
export function floodZone(attributes: Record<string, unknown>): "A" | "B" | null {
  for (const [key, value] of Object.entries(attributes)) {
    if (!/flood|zone|extent|fluvial|coastal|probability|aep/i.test(key)) continue;
    if (typeof value === "string") {
      if (/zone\s*a\b|high|0\.1%|1%|fluvial/i.test(value)) return "A";
      if (/zone\s*b\b|moderate|0\.1%/i.test(value)) return "B";
    }
    // Annual Exceedance Probability as a fraction: ≥1% → Zone A, ≥0.1% → Zone B.
    if (typeof value === "number") {
      if (value >= 0.01) return "A";
      if (value >= 0.001) return "B";
    }
  }
  // A feature was returned at all → the point is inside some mapped extent.
  return "A";
}
