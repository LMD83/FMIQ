/**
 * VerifIQ — geospatial data-access module (Phase 5).
 *
 * Adapter layer for Irish site-constraint data (docs/35). Ships the EPA radon
 * provider as the reference GeoLayerProvider + a customer-supplied geocoder; the
 * other layers (flood/OPW, geology/GSI, zoning/MyPlan, heritage, ecology/NPWS)
 * follow the same shape, and a licensed Eircode-provider geocoder is a pluggable
 * add-on.
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
export { buildPointQueryUrl, firstFeatureAttributes, ITM_WKID } from "./arcgis.js";
export { EpaRadonProvider, isHighRadon } from "./radon.js";
export { OpwFloodProvider, floodZone } from "./flood.js";
export { GsiGeologyProvider, adverseGround } from "./geology.js";
export { geoFinding } from "./findings.js";
export { CustomerSuppliedGeocoder } from "./geocoder.js";
