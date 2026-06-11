import type { PoolClient } from 'pg';

/**
 * Sustainability (P2): utility metering, carbon, Bizot Green Protocol compliance, and a
 * SEAI M&R export. Bizot compliance is computed live from collection-care telemetry —
 * the heritage-unique "energy vs conservation" balance. See roadmap + master plan §I.
 */

/** Standard Irish grid emission factors (kgCO2e/kWh) — indicative; configurable per year. */
const EMISSION_FACTOR: Record<string, number> = { elec: 0.2263, gas: 0.2024, oil: 0.2571, water: 0.0 };

export async function recordMeterReading(client: PoolClient, tenantId: string, input: { meterId: string; value: number; ts?: string }): Promise<void> {
  await client.query(`INSERT INTO sus_reading (tenant_id, meter_id, value, ts) VALUES ($1,$2,$3, COALESCE($4, now()))`, [tenantId, input.meterId, input.value, input.ts ?? null]);
}

/** kgCO2e for a building over a period from metered consumption × utility factor. */
export async function carbonForBuilding(client: PoolClient, _tenantId: string, buildingId: string, from: string, to: string): Promise<{ tco2e: number; byUtility: Record<string, number> }> {
  const { rows } = await client.query<{ utility: string; total: number }>(
    `SELECT m.utility, COALESCE(sum(r.value),0) AS total
       FROM sus_meter m JOIN sus_reading r ON r.meter_id = m.id
      WHERE m.building_id = $1 AND r.ts >= $2 AND r.ts < $3
      GROUP BY m.utility`,
    [buildingId, from, to],
  );
  const byUtility: Record<string, number> = {};
  let kg = 0;
  for (const r of rows) {
    const co2 = Number(r.total) * (EMISSION_FACTOR[r.utility] ?? 0);
    byUtility[r.utility] = co2;
    kg += co2;
  }
  return { tco2e: Math.round((kg / 1000) * 1000) / 1000, byUtility };
}

/**
 * Bizot Green Protocol compliance for a zone over a window: % of RH readings within the
 * Bizot band (40–60%). Computed live from cc_reading and persisted as a period snapshot.
 */
export async function computeBizotCompliance(client: PoolClient, tenantId: string, zoneId: string, period: string, from: string, to: string): Promise<{ pctHoursInBand: number }> {
  const { rows } = await client.query<{ total: number; in_band: number }>(
    `SELECT count(*) AS total,
            count(*) FILTER (WHERE value BETWEEN 40 AND 60) AS in_band
       FROM cc_reading WHERE zone_id = $1 AND metric = 'rh' AND ts >= $2 AND ts < $3`,
    [zoneId, from, to],
  );
  const total = Number(rows[0].total);
  const pct = total === 0 ? 100 : Math.round((Number(rows[0].in_band) / total) * 1000) / 10;
  await client.query(
    `INSERT INTO sus_bizot_compliance (tenant_id, cc_zone_id, period, pct_hours_in_band) VALUES ($1,$2,$3,$4)`,
    [tenantId, zoneId, period, pct],
  );
  return { pctHoursInBand: pct };
}

export interface SeaiRow {
  building: string;
  utility: string;
  totalConsumption: number;
}

/** SEAI Monitoring & Reporting annual export — per building × utility consumption. */
export async function seaiExport(client: PoolClient, _tenantId: string, year: number): Promise<{ year: number; rows: SeaiRow[]; csv: string }> {
  const from = `${year}-01-01`;
  const to = `${year + 1}-01-01`;
  const { rows } = await client.query<{ building: string; utility: string; total: number }>(
    `SELECT b.name AS building, m.utility, COALESCE(sum(r.value),0) AS total
       FROM sus_meter m
       JOIN est_building b ON b.id = m.building_id
       LEFT JOIN sus_reading r ON r.meter_id = m.id AND r.ts >= $1 AND r.ts < $2
      GROUP BY b.name, m.utility
      ORDER BY b.name, m.utility`,
    [from, to],
  );
  const out: SeaiRow[] = rows.map((r) => ({ building: r.building, utility: r.utility, totalConsumption: Number(r.total) }));
  const csv = ['building,utility,total_consumption', ...out.map((r) => `${r.building},${r.utility},${r.totalConsumption}`)].join('\n');
  return { year, rows: out, csv };
}
