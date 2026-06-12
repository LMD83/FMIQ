/**
 * Charity Cloud — geohash utilities (privacy-preserving location).
 *
 * Privacy rule 1: addresses/Eircodes are geocoded TRANSIENTLY, snapped to a
 * geohash precision-5 cell (~4.9 km × 4.9 km), and the input is discarded.
 * Only the cell string is ever persisted. Donor↔need proximity is "same cell
 * or one of its 8 neighbours" — i.e. "within ~5km", never an exact distance
 * (rule 9: no trilateration surface).
 *
 * Pure TS, no deps; tested against published geohash vectors.
 */

const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

export const GEOHASH_PRECISION = 5 as const;

/** Encode lat/lon to a geohash of the given precision (default 5). */
export function encodeGeohash(lat: number, lon: number, precision: number = GEOHASH_PRECISION): string {
  if (!(lat >= -90 && lat <= 90) || !(lon >= -180 && lon <= 180)) {
    throw new Error("encodeGeohash: lat/lon out of range");
  }
  let latMin = -90, latMax = 90, lonMin = -180, lonMax = 180;
  let hash = "";
  let bit = 0, ch = 0, evenBit = true;
  while (hash.length < precision) {
    if (evenBit) {
      const mid = (lonMin + lonMax) / 2;
      if (lon >= mid) { ch = (ch << 1) | 1; lonMin = mid; } else { ch = ch << 1; lonMax = mid; }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) { ch = (ch << 1) | 1; latMin = mid; } else { ch = ch << 1; latMax = mid; }
    }
    evenBit = !evenBit;
    if (++bit === 5) {
      hash += BASE32.charAt(ch);
      bit = 0; ch = 0;
    }
  }
  return hash;
}

/** Decode a geohash to its cell-centre lat/lon (used only for area labels). */
export function decodeGeohash(hash: string): { lat: number; lon: number } {
  let latMin = -90, latMax = 90, lonMin = -180, lonMax = 180;
  let evenBit = true;
  for (const c of hash.toLowerCase()) {
    const idx = BASE32.indexOf(c);
    if (idx === -1) throw new Error(`decodeGeohash: invalid character "${c}"`);
    for (let n = 4; n >= 0; n--) {
      const bitN = (idx >> n) & 1;
      if (evenBit) {
        const mid = (lonMin + lonMax) / 2;
        if (bitN === 1) lonMin = mid; else lonMax = mid;
      } else {
        const mid = (latMin + latMax) / 2;
        if (bitN === 1) latMin = mid; else latMax = mid;
      }
      evenBit = !evenBit;
    }
  }
  return { lat: (latMin + latMax) / 2, lon: (lonMin + lonMax) / 2 };
}

type Direction = "n" | "s" | "e" | "w";

const NEIGHBOUR_TABLE: Record<Direction, [string, string]> = {
  // [even (lon-first) charset map, odd charset map]
  n: ["p0r21436x8zb9dcf5h7kjnmqesgutwvy", "bc01fg45238967deuvhjyznpkmstqrwx"],
  s: ["14365h7k9dcfesgujnmqp0r2twvyx8zb", "238967debc01fg45kmstqrwxuvhjyznp"],
  e: ["bc01fg45238967deuvhjyznpkmstqrwx", "p0r21436x8zb9dcf5h7kjnmqesgutwvy"],
  w: ["238967debc01fg45kmstqrwxuvhjyznp", "14365h7k9dcfesgujnmqp0r2twvyx8zb"],
};

const BORDER_TABLE: Record<Direction, [string, string]> = {
  n: ["prxz", "bcfguvyz"],
  s: ["028b", "0145hjnp"],
  e: ["bcfguvyz", "prxz"],
  w: ["0145hjnp", "028b"],
};

/** The adjacent geohash cell in the given compass direction. */
export function adjacentCell(hash: string, direction: Direction): string {
  const h = hash.toLowerCase();
  if (h.length === 0) throw new Error("adjacentCell: empty geohash");
  const last = h.charAt(h.length - 1);
  let parent = h.slice(0, -1);
  const type = h.length % 2; // 1 = odd length
  const borders = BORDER_TABLE[direction][type] as string;
  if (borders.includes(last) && parent !== "") {
    parent = adjacentCell(parent, direction);
  }
  const neighbours = NEIGHBOUR_TABLE[direction][type] as string;
  return parent + BASE32.charAt(neighbours.indexOf(last));
}

/**
 * The 8 cells surrounding `hash` (N, NE, E, SE, S, SW, W, NW).
 * Donor matching queries the donor's own cell plus these 8.
 */
export function neighbourCells(hash: string): string[] {
  const n = adjacentCell(hash, "n");
  const s = adjacentCell(hash, "s");
  return [
    n,
    adjacentCell(n, "e"),
    adjacentCell(hash, "e"),
    adjacentCell(s, "e"),
    s,
    adjacentCell(s, "w"),
    adjacentCell(hash, "w"),
    adjacentCell(n, "w"),
  ];
}

/** The donor's search set: own cell + 8 neighbours (9 cells, ~15km square). */
export function searchCells(hash: string): string[] {
  return [hash, ...neighbourCells(hash)];
}
