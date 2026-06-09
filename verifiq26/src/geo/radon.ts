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
import { buildPointQueryUrl, queryPointLayer } from "./arcgis.js";

const ENDPOINT =
  "https://gis.epa.ie/arcgis/rest/services/EPAMapServices/RadiologicalProtection/MapServer/1/query";

export class EpaRadonProvider implements GeoLayerProvider {
  readonly layer = "radon";
  constructor(private readonly fetchJson: FetchJson = defaultFetchJson) {}

  /** Build the ArcGIS point-intersect query URL for a coordinate. */
  buildUrl(coord: ItmCoordinate): string {
    return buildPointQueryUrl(ENDPOINT, coord);
  }

  query(coord: ItmCoordinate): Promise<GeoLayerResult> {
    return queryPointLayer(
      this.fetchJson,
      {
        layer: this.layer,
        endpoint: ENDPOINT,
        requestFrom: "EPA Radon Map (epa.ie/environment-and-you/radon/radon-map)",
        unreachableSummary: "EPA radon layer not reachable — confirm the radon category manually.",
        classify: (attributes) => {
          if (!attributes) return { summary: "Site is not within a mapped EPA High Radon Area." };
          const high = isHighRadon(attributes);
          return {
            flagged: high,
            summary: high
              ? "Site is in an EPA High Radon Area — radon-resisting measures apply (TGD C)."
              : "Site is not in an EPA High Radon Area.",
          };
        },
      },
      coord,
    );
  }
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
