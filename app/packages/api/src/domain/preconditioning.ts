import type { PoolClient } from 'pg';
import type { ForecastPoint } from '../adapters/metEireann.js';

/**
 * Predictive collection-care pre-conditioning (P2 differentiator). Given a zone's target
 * band and an incoming Met Éireann forecast, recommend BMS setpoint actions BEFORE a
 * predicted excursion — shifting the headline claim from "we respond faster" to "we
 * prevent damage". See docs/FMIQ-system-review.md §3.5.
 */

export interface ZoneBand {
  rh_min: number | null;
  rh_max: number | null;
  temp_min: number | null;
  temp_max: number | null;
}

export interface PreconditionAction {
  ts: string;
  metric: 'rh' | 'temp';
  predicted: number;
  action: 'humidify' | 'dehumidify' | 'heat' | 'cool';
  leadHours: number;
}

/** Outdoor RH/temp shift the indoor zone by a damped fraction (heritage fabric is slow). */
const COUPLING = 0.5;

export function assessPreconditioning(band: ZoneBand, forecast: ForecastPoint[], now: Date = new Date()): PreconditionAction[] {
  const actions: PreconditionAction[] = [];
  for (const p of forecast) {
    const leadHours = (new Date(p.ts).getTime() - now.getTime()) / 3_600_000;
    if (leadHours <= 0) continue; // only act ahead of time

    if (p.rh != null && band.rh_max != null && band.rh_min != null) {
      const projected = midpoint(band.rh_min, band.rh_max) + (p.rh - midpoint(band.rh_min, band.rh_max)) * COUPLING;
      if (projected > band.rh_max) actions.push({ ts: p.ts, metric: 'rh', predicted: round(projected), action: 'dehumidify', leadHours: round(leadHours) });
      else if (projected < band.rh_min) actions.push({ ts: p.ts, metric: 'rh', predicted: round(projected), action: 'humidify', leadHours: round(leadHours) });
    }
    if (p.tempC != null && band.temp_max != null && band.temp_min != null) {
      const projected = midpoint(band.temp_min, band.temp_max) + (p.tempC - midpoint(band.temp_min, band.temp_max)) * COUPLING;
      if (projected > band.temp_max) actions.push({ ts: p.ts, metric: 'temp', predicted: round(projected), action: 'cool', leadHours: round(leadHours) });
      else if (projected < band.temp_min) actions.push({ ts: p.ts, metric: 'temp', predicted: round(projected), action: 'heat', leadHours: round(leadHours) });
    }
  }
  return actions;
}

function midpoint(a: number, b: number): number {
  return (a + b) / 2;
}
function round(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Load a zone's active target band (for the pre-conditioning route). */
export async function loadZoneBand(client: PoolClient, zoneId: string): Promise<ZoneBand | null> {
  const { rows } = await client.query<ZoneBand>(
    `SELECT rh_min, rh_max, temp_min, temp_max FROM cc_zone_target WHERE cc_zone_id = $1 AND active = true ORDER BY id LIMIT 1`,
    [zoneId],
  );
  return rows[0] ?? null;
}
