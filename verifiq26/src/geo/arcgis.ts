/**
 * VerifIQ — shared ArcGIS REST point-query plumbing (Phase 5).
 *
 * The Irish open constraint layers (radon, flood, geology, zoning, heritage,
 * ecology) are nearly all ArcGIS REST MapServer/FeatureServer layers queried the
 * same way: a point-intersect query in ITM (EPSG:2157) returning JSON features.
 * Each GeoLayerProvider keeps its own endpoint + flag logic; this module owns the
 * URL building (with the finite-coordinate guard) and feature extraction so that
 * logic lives in exactly one place.
 *
 * Version: 0.8.0-phase5
 */

import type { ItmCoordinate } from "./types.js";

export const ITM_WKID = 2157;

/** Build an ArcGIS point-intersect query URL for a coordinate (ITM by default). */
export function buildPointQueryUrl(
  endpoint: string,
  coord: ItmCoordinate,
  wkid: number = ITM_WKID,
): string {
  if (!Number.isFinite(coord.x) || !Number.isFinite(coord.y)) {
    throw new Error(`Invalid ITM coordinate: ${coord.x},${coord.y}`);
  }
  const params = new URLSearchParams({
    geometry: `${coord.x},${coord.y}`,
    geometryType: "esriGeometryPoint",
    inSR: String(wkid),
    spatialRel: "esriSpatialRelIntersects",
    outFields: "*",
    returnGeometry: "false",
    f: "json",
  });
  return `${endpoint}?${params.toString()}`;
}

/** Attributes of the first returned feature, or null when none intersect. */
export function firstFeatureAttributes(json: unknown): Record<string, unknown> | null {
  if (typeof json !== "object" || json === null) return null;
  const features = (json as { features?: unknown }).features;
  if (!Array.isArray(features) || features.length === 0) return null;
  const attributes = (features[0] as { attributes?: unknown }).attributes;
  return (attributes ?? {}) as Record<string, unknown>;
}
