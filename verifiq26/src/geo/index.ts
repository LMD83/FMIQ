/**
 * VerifIQ — geospatial data-access module (Phase 5).
 *
 * Adapter layer for Irish site-constraint data (docs/35). Ships the free open-API
 * GeoLayerProviders — radon (EPA), flood (OPW), geology (GSI), zoning (MyPlan),
 * ecology (NPWS), heritage (SMR/NIAH) — plus a customer-supplied geocoder. Every
 * layer shares the SSRF-safe ArcGIS point-query plumbing (hardcoded endpoint +
 * finite-coordinate guard + graceful degradation); a licensed Eircode-provider
 * geocoder is a pluggable add-on.
 *
 * Version: 0.8.0-phase5
 */

export {
  type ItmCoordinate,
  type GeoStatus,
  type GeoLayerResult,
  type GeoLayerProvider,
  type Geocoder,
  type FetchJson,
  defaultFetchJson,
} from "./types.js";
export { buildPointQueryUrl, firstFeatureAttributes, queryPointLayer, ITM_WKID } from "./arcgis.js";
export type { PointLayerSpec } from "./arcgis.js";
export { EpaRadonProvider, isHighRadon } from "./radon.js";
export { OpwFloodProvider, floodZone } from "./flood.js";
export { GsiGeologyProvider, adverseGround } from "./geology.js";
export { MyPlanZoningProvider, zoningObjective } from "./zoning.js";
export { NpwsEcologyProvider, designatedSite } from "./ecology.js";
export { HeritageProvider, recordedMonument } from "./heritage.js";
export { geoFinding } from "./findings.js";
export { CustomerSuppliedGeocoder } from "./geocoder.js";
