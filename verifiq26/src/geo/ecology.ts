/**
 * VerifIQ — NPWS designated-areas (ecology) layer adapter (Phase 5).
 *
 * Queries the NPWS designated-areas service (SAC / SPA / NHA / pNHA) for whether
 * a site sits within, or adjacent to, a designated nature-conservation area, by
 * ITM coordinate. Same shape as the other adapters; the presence of a designation
 * is the flag.
 *
 * Anchor: Habitats Directive (92/43/EEC) + Birds Directive (2009/147/EC),
 * transposed by the European Communities (Birds and Natural Habitats)
 * Regulations 2011 (S.I. 477/2011) — a plan/project that may affect a European
 * site requires Appropriate Assessment screening. Endpoint per docs/35.
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
  "https://services-eu1.arcgis.com/HyjXgkV6KGMSF3jt/arcgis/rest/services/NPWS_Designated_Areas/FeatureServer/0/query";

export class NpwsEcologyProvider implements GeoLayerProvider {
  readonly layer = "ecology";
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
        requestFrom: "NPWS designated-site data (npws.ie)",
        unreachableSummary: "NPWS ecology layer not reachable — confirm designated-area status manually.",
        classify: (attributes) => {
          const site = attributes ? designatedSite(attributes) : null;
          if (!site) return { summary: "Site is not within a mapped NPWS designated area." };
          return {
            flagged: true,
            summary: `Site is within / adjoins a designated area (${site}) — Appropriate Assessment screening applies.`,
          };
        },
      },
      coord,
    );
  }
}

/** Read a designated-area name/type from feature attributes (fields vary). */
export function designatedSite(attributes: Record<string, unknown>): string | null {
  for (const [key, value] of Object.entries(attributes)) {
    if (!/sac|spa|nha|site_?name|designat|sitecode|type|name/i.test(key)) continue;
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  return null;
}
