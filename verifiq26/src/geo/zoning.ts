/**
 * VerifIQ — MyPlan / development-plan zoning layer adapter (Phase 5).
 *
 * Queries the national Generalised Zoning Type (GZT) FeatureServer (MyPlan /
 * DHLGH, ArcGIS Online) for the zoning objective at a site, by ITM coordinate.
 * Zoning is always "present", so the value here is surfacing the objective so the
 * team confirms the proposed use is consistent with it (a material-contravention
 * check), rather than flagging a hazard.
 *
 * Anchor: Planning and Development Act 2000 (as amended) — a development that
 * materially contravenes the zoning objective of the development plan is a
 * planning risk. Endpoint per docs/35 (verify live).
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
  "https://services-eu1.arcgis.com/HyjXgkV6KGMSF3jt/arcgis/rest/services/Generalised_Zoning_Type/FeatureServer/0/query";

export class MyPlanZoningProvider implements GeoLayerProvider {
  readonly layer = "zoning";
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
        requestFrom: "the relevant local authority development plan / MyPlan (myplan.ie)",
        unreachableSummary: "Zoning layer not reachable — confirm the zoning objective manually.",
        classify: (attributes) => {
          const zone = attributes ? zoningObjective(attributes) : null;
          if (!zone) {
            return { summary: "No generalised zoning objective mapped at the site (confirm with the development plan)." };
          }
          return {
            flagged: true,
            summary: `Site zoning objective: ${zone}. Confirm the proposed use is consistent with it.`,
          };
        },
      },
      coord,
    );
  }
}

/** Read a human-readable zoning objective from feature attributes (fields vary). */
export function zoningObjective(attributes: Record<string, unknown>): string | null {
  for (const [key, value] of Object.entries(attributes)) {
    if (!/zon|objective|landuse|land_use|gzt|category|description/i.test(key)) continue;
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  return null;
}
