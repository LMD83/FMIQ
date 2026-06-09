/**
 * VerifIQ — geocoders (Phase 5).
 *
 * `CustomerSuppliedGeocoder` is the €0 default: the intake captures the site
 * coordinate (or it's read from the site-location drawing), so no Eircode licence
 * is needed to run the free constraint-layer queries. A licensed Eircode-provider
 * geocoder (Autoaddress/Loqate) is a pluggable add-on (docs/35) and is
 * intentionally not built here.
 *
 * Version: 0.8.0-phase5
 */

import type { Geocoder, ItmCoordinate } from "./types.js";

export class CustomerSuppliedGeocoder implements Geocoder {
  constructor(private readonly coord: ItmCoordinate | null) {}
  async resolve(): Promise<ItmCoordinate | null> {
    return this.coord;
  }
}
