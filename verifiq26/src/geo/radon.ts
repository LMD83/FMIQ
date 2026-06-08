/**
 * VerifIQ — EPA radon layer adapter (Phase 5 reference GeoLayerProvider).
 *
 * Queries the EPA Radiological Protection MapServer (a free, open, no-auth ArcGIS
 * REST service — the one endpoint confirmed live during research) for a site's
 * High-Radon-Area status, by ITM coordinate. The fetcher is injected so this is
 * unit-tested without the network.
 *
 * Anchor: Building Regulations Part C / TGD C (2023) — radon-resisting membrane
 * required in High Radon Areas (EPA radon map; reference level 200 Bq/m³).
 * Endpoint: gis.epa.ie/.../RadiologicalProtection/MapServer/1 (docs/35).
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

const ENDPOINT =
  "https://gis.epa.ie/arcgis/rest/services/EPAMapServices/RadiologicalProtection/MapServer/1/query";
const ITM_WKID = 2157;

export class EpaRadonProvider implements GeoLayerProvider {
  readonly layer = "radon";
  constructor(private readonly fetchJson: FetchJson = defaultFetchJson) {}

  /** Build the ArcGIS point-intersect query URL for a coordinate. */
  buildUrl(coord: ItmCoordinate): string {
    const params = new URLSearchParams({
      geometry: `${coord.x},${coord.y}`,
      geometryType: "esriGeometryPoint",
      inSR: String(ITM_WKID),
      spatialRel: "esriSpatialRelIntersects",
      outFields: "*",
      returnGeometry: "false",
      f: "json",
    });
    return `${ENDPOINT}?${params.toString()}`;
  }

  async query(coord: ItmCoordinate): Promise<GeoLayerResult> {
    let json: unknown;
    try {
      json = await this.fetchJson(this.buildUrl(coord));
    } catch {
      // Graceful degradation — the layer is open but unreachable right now.
      return {
        layer: this.layer,
        status: "manual-request-required",
        summary: "EPA radon layer not reachable — confirm the radon category manually.",
        requestFrom: "EPA Radon Map (epa.ie/environment-and-you/radon/radon-map)",
      };
    }

    const feature = firstFeature(json);
    if (!feature) {
      return {
        layer: this.layer,
        status: "resolved",
        summary: "Site is not within a mapped EPA High Radon Area.",
      };
    }
    const attributes = (feature.attributes ?? {}) as Record<string, unknown>;
    const high = isHighRadon(attributes);
    return {
      layer: this.layer,
      status: "resolved",
      flagged: high,
      summary: high
        ? "Site is in an EPA High Radon Area — radon-resisting measures apply (TGD C)."
        : "Site is not in an EPA High Radon Area.",
      attributes,
    };
  }
}

function firstFeature(json: unknown): { attributes?: unknown } | null {
  if (typeof json !== "object" || json === null) return null;
  const features = (json as { features?: unknown }).features;
  if (!Array.isArray(features) || features.length === 0) return null;
  return features[0] as { attributes?: unknown };
}

/** Detect a High Radon Area from the feature attributes (field names vary). */
export function isHighRadon(attributes: Record<string, unknown>): boolean {
  for (const [key, value] of Object.entries(attributes)) {
    if (!/radon|high|percent|reference/i.test(key)) continue;
    if (typeof value === "string" && /high|yes|true/i.test(value)) return true;
    if (typeof value === "number" && value >= 10) return true; // ≥10% homes > reference
    if (value === true) return true;
  }
  return false;
}
