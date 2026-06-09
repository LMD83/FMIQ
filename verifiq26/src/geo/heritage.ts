/**
 * VerifIQ — archaeological / architectural heritage layer adapter (Phase 5).
 *
 * Queries the National Monuments Service SMR/RMP open data (recorded monuments)
 * for whether a site contains, or is near, a recorded monument, by ITM
 * coordinate. The presence of a recorded monument is the flag (NIAH architectural
 * heritage and Protected Structures follow the same provider shape against their
 * own endpoints).
 *
 * Anchor: National Monuments Acts 1930–2014 — works at or near a Recorded
 * Monument require two months' written notice to the Minister/National Monuments
 * Service before works commence. Endpoint per docs/35 (verify live).
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
  "https://services-eu1.arcgis.com/HyjXgkV6KGMSF3jt/arcgis/rest/services/SMROpenData/FeatureServer/0/query";

export class HeritageProvider implements GeoLayerProvider {
  readonly layer = "heritage";
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
        requestFrom: "National Monuments Service (archaeology.ie); NIAH (buildingsofireland.ie)",
        unreachableSummary: "Heritage layer not reachable — confirm recorded-monument status manually.",
        classify: (attributes) => {
          const monument = attributes ? recordedMonument(attributes) : null;
          if (!monument) return { summary: "No recorded monument mapped at the site." };
          return {
            flagged: true,
            summary: `A recorded monument is mapped at/near the site (${monument}) — statutory notice applies before works.`,
          };
        },
      },
      coord,
    );
  }
}

/** Read a monument class/number from feature attributes (fields vary). */
export function recordedMonument(attributes: Record<string, unknown>): string | null {
  for (const [key, value] of Object.entries(attributes)) {
    if (!/smr|rmp|monument|class|classdesc|smrs|number|name/i.test(key)) continue;
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  return null;
}
