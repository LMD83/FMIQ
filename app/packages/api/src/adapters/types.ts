import type { Reading } from '../domain/collectionCare.js';

/**
 * Hardware-agnostic sensor adapter contract.
 *
 * Each integrated platform (Conserv, Hanwell, T&D, a BMS gateway, raw MQTT)
 * implements `parse`, turning that vendor's payload into a vendor-neutral
 * envelope: an external sensor id + a list of normalised metric readings.
 * The route layer then resolves the external id to an FMIQ sensor/zone and
 * feeds each reading to the SAME collection-care engine. Adding a vendor is a
 * new adapter file — never a change to the engine. This is the "third-party
 * integration via standard connectors, not bespoke" claim, in code.
 */

export type Metric = Reading['metric'];

export interface NormalisedReading {
  metric: Metric;
  value: number;
  unit?: string;
  ts?: string;
}

export interface ParsedSensorReadings {
  /** Vendor's own device identifier — mapped to cc_sensor.external_id. */
  externalId: string;
  readings: NormalisedReading[];
}

export interface SensorAdapter {
  vendor: 'conserv' | 'hanwell' | 'tandd' | 'hobo' | 'bms';
  /** Parse a raw vendor payload. Throws if the payload is unrecognised. */
  parse(payload: unknown): ParsedSensorReadings;
}

/** Maps common vendor metric labels onto FMIQ's canonical metric codes. */
export function canonicalMetric(label: string): Metric | null {
  const m = label.trim().toLowerCase();
  if (['temp', 'temperature', 't'].includes(m)) return 'temp';
  if (['rh', 'humidity', 'relative_humidity', 'relativehumidity'].includes(m)) return 'rh';
  if (['lux', 'light', 'illuminance', 'visible_light'].includes(m)) return 'lux';
  if (['uv', 'ultraviolet', 'uv_index'].includes(m)) return 'uv';
  if (['co2', 'carbon_dioxide'].includes(m)) return 'co2';
  if (['voc', 'pollutants', 'tvoc'].includes(m)) return 'voc';
  if (['shock', 'vibration'].includes(m)) return 'shock';
  return null;
}
