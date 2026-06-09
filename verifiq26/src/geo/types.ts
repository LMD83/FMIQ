/**
 * VerifIQ — geospatial data-access ports (Phase 5).
 *
 * The constraint layers (radon, flood, geology, zoning, heritage, ecology) are
 * mostly free open ArcGIS REST / WFS APIs; the one choke-point is turning an
 * address/Eircode into a coordinate (Eircode geocoding is licensed). These ports
 * mirror the StorageProvider / LLMProvider pattern with graceful degradation, so
 * a gated/unreachable layer becomes a tracked "evidence required" finding rather
 * than a silent miss. See docs/35-geospatial-data-access.md.
 *
 * Version: 0.8.0-phase5
 */

/** Irish Transverse Mercator coordinate (EPSG:2157). */
export interface ItmCoordinate {
  x: number;
  y: number;
}

export type GeoStatus = "resolved" | "manual-request-required" | "customer-supplied";

/** Result of querying one constraint layer at a coordinate. */
export interface GeoLayerResult {
  layer: string;
  status: GeoStatus;
  summary: string;
  /** True when a constraint is present (e.g. site IS in a High Radon Area). */
  flagged?: boolean;
  attributes?: Record<string, unknown>;
  /** Authority to request from when `manual-request-required`. */
  requestFrom?: string;
}

export interface GeoLayerProvider {
  readonly layer: string;
  query(coord: ItmCoordinate): Promise<GeoLayerResult>;
}

/** Injectable JSON fetcher so adapters are unit-testable without the network. */
export type FetchJson = (url: string) => Promise<unknown>;

/** Default fetcher (browser/Node global fetch). */
export const defaultFetchJson: FetchJson = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
};

/**
 * Resolves a site to an ITM coordinate. The €0 default is customer-supplied
 * (the intake captures it); a licensed Eircode-provider adapter is a flagged,
 * pluggable add-on (docs/35). `resolve()` returns null when no coordinate is
 * available → the caller emits a "coordinate required" finding.
 */
export interface Geocoder {
  resolve(): Promise<ItmCoordinate | null>;
}
