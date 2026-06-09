/**
 * VerifIQ — GSI geology / ground-conditions layer adapter (Phase 5).
 *
 * Queries the Geological Survey Ireland REST services (subsoils, landslide
 * susceptibility, karst, made-ground/peat) for adverse ground conditions at a
 * site, by ITM coordinate. Same shape as the EPA radon adapter: injected fetcher,
 * finite-coordinate guard, graceful degradation to a "request from GSI" finding.
 *
 * Anchor: adverse ground (peat/made ground, landslide susceptibility, karst)
 * drives the need for a ground investigation + geotechnical design to Eurocode 7
 * (IS EN 1997) — a pre-construction evidence item. Endpoint per docs/35 (verify
 * live).
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
  "https://gsi.geodata.gov.ie/server/rest/services/Geology/IE_GSI_Subsoils_Quaternary_Sediments/MapServer/0/query";

export class GsiGeologyProvider implements GeoLayerProvider {
  readonly layer = "geology";
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
        requestFrom: "Geological Survey Ireland (gsi.geodata.gov.ie)",
        unreachableSummary: "GSI ground layer not reachable — confirm ground conditions manually.",
        classify: (attributes) => {
          if (!attributes) return { summary: "No adverse ground condition mapped at the site by GSI." };
          const adverse = adverseGround(attributes);
          return {
            flagged: Boolean(adverse),
            summary: adverse
              ? `GSI maps an adverse ground condition at the site (${adverse}) — a ground investigation applies.`
              : "GSI maps no adverse ground condition at the site.",
          };
        },
      },
      coord,
    );
  }
}

/**
 * Detect an adverse ground condition (peat, made ground, landslide susceptibility,
 * karst) from feature attributes. Returns a short label, or null when benign.
 */
export function adverseGround(attributes: Record<string, unknown>): string | null {
  for (const value of Object.values(attributes)) {
    if (typeof value !== "string") continue;
    if (/\bpeat\b|made\s*ground|fill\b|alluvium/i.test(value)) return value;
    if (/landslide|unstable|susceptib/i.test(value)) return value;
    if (/karst/i.test(value)) return value;
  }
  return null;
}
