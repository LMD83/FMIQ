/**
 * Charity Cloud — transient Eircode → area mapping (Ireland).
 *
 * Privacy rule 1 implementation for the MVP: we never call an external
 * geocoder and never persist the Eircode. Only the ROUTING KEY (first 3
 * chars — a public, ~town-sized postal district) is looked up in this static
 * table to yield a geohash-5 cell + human area label; the input is discarded
 * by the caller. An EU-hosted no-logging geocoder can replace this table later
 * (docs/ROADMAP-WEEKEND.md) without touching any persistence.
 *
 * Coordinates are the approximate district centroid — deliberately coarse.
 */
import { encodeGeohash } from "./geo";

interface District {
  label: string;
  lat: number;
  lon: number;
}

export const ROUTING_KEYS: Record<string, District> = {
  D01: { label: "Dublin 1", lat: 53.3525, lon: -6.2603 },
  D02: { label: "Dublin 2", lat: 53.3398, lon: -6.2489 },
  D03: { label: "Dublin 3", lat: 53.3633, lon: -6.2243 },
  D04: { label: "Dublin 4", lat: 53.3284, lon: -6.2229 },
  D05: { label: "Dublin 5", lat: 53.3838, lon: -6.1846 },
  D06: { label: "Dublin 6", lat: 53.3091, lon: -6.2616 },
  D6W: { label: "Dublin 6W", lat: 53.3022, lon: -6.3011 },
  D07: { label: "Dublin 7", lat: 53.3597, lon: -6.2912 },
  D08: { label: "Dublin 8", lat: 53.3382, lon: -6.2939 },
  D09: { label: "Dublin 9", lat: 53.3853, lon: -6.2466 },
  D10: { label: "Dublin 10", lat: 53.3399, lon: -6.3573 },
  D11: { label: "Dublin 11", lat: 53.3905, lon: -6.2973 },
  D12: { label: "Dublin 12", lat: 53.3221, lon: -6.3146 },
  D13: { label: "Dublin 13", lat: 53.3946, lon: -6.1469 },
  D14: { label: "Dublin 14", lat: 53.2956, lon: -6.2462 },
  D15: { label: "Dublin 15", lat: 53.3832, lon: -6.4185 },
  D16: { label: "Dublin 16", lat: 53.2768, lon: -6.2823 },
  D17: { label: "Dublin 17", lat: 53.4019, lon: -6.2123 },
  D18: { label: "Dublin 18", lat: 53.2538, lon: -6.1764 },
  D20: { label: "Dublin 20", lat: 53.3494, lon: -6.3661 },
  D22: { label: "Dublin 22 (Clondalkin)", lat: 53.3236, lon: -6.3946 },
  D24: { label: "Dublin 24 (Tallaght)", lat: 53.2862, lon: -6.3704 },
  A94: { label: "Blackrock", lat: 53.3015, lon: -6.1778 },
  A96: { label: "Dún Laoghaire", lat: 53.2941, lon: -6.1339 },
  K67: { label: "Swords", lat: 53.4597, lon: -6.2181 },
  K78: { label: "Lucan", lat: 53.3573, lon: -6.4489 },
  W23: { label: "Maynooth / Celbridge", lat: 53.3817, lon: -6.5934 },
  T12: { label: "Cork city (south)", lat: 51.8917, lon: -8.4756 },
  T23: { label: "Cork city (north)", lat: 51.9097, lon: -8.4654 },
  H91: { label: "Galway city", lat: 53.2745, lon: -9.0568 },
  V94: { label: "Limerick city", lat: 52.6653, lon: -8.6238 },
  X91: { label: "Waterford city", lat: 52.2567, lon: -7.1292 },
};

export interface AreaResolution {
  geoCell: string;
  areaLabel: string;
}

/**
 * Resolve an Eircode (or bare routing key) to {geoCell, areaLabel}.
 * The full Eircode is used ONLY to read its first 3 characters; callers must
 * not persist or log the input (rule 1).
 */
export function resolveArea(eircodeOrRoutingKey: string): AreaResolution | null {
  const key = eircodeOrRoutingKey.trim().toUpperCase().slice(0, 3);
  const district = ROUTING_KEYS[key];
  if (!district) return null;
  return {
    geoCell: encodeGeohash(district.lat, district.lon, 5),
    areaLabel: district.label,
  };
}
