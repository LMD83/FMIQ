// P2 — sustainability: carbon, Bizot compliance, SEAI export.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pool } from '../src/db/pool.js';
import { withTenant } from '../src/db/withTenant.js';
import { createTenant } from './helpers/db.js';
import { carbonForBuilding, computeBizotCompliance, recordMeterReading, seaiExport } from '../src/domain/sustainability.js';

let tenant: string;
let buildingId: string;
let meterId: string;
let zoneId: string;
let sensorId: string;

beforeAll(async () => {
  tenant = await createTenant('sus');
  await withTenant(tenant, async (c) => {
    const site = (await c.query<{ id: string }>(`INSERT INTO est_site (tenant_id, name) VALUES ($1,'S') RETURNING id`, [tenant])).rows[0].id;
    buildingId = (await c.query<{ id: string }>(`INSERT INTO est_building (tenant_id, site_id, name) VALUES ($1,$2,'B') RETURNING id`, [tenant, site])).rows[0].id;
    const f = (await c.query<{ id: string }>(`INSERT INTO est_floor (tenant_id, building_id, name) VALUES ($1,$2,'F') RETURNING id`, [tenant, buildingId])).rows[0].id;
    const sp = (await c.query<{ id: string }>(`INSERT INTO est_space (tenant_id, floor_id, name, space_type) VALUES ($1,$2,'G','gallery') RETURNING id`, [tenant, f])).rows[0].id;
    meterId = (await c.query<{ id: string }>(`INSERT INTO sus_meter (tenant_id, building_id, utility) VALUES ($1,$2,'elec') RETURNING id`, [tenant, buildingId])).rows[0].id;
    zoneId = (await c.query<{ id: string }>(`INSERT INTO cc_zone (tenant_id, space_id, name) VALUES ($1,$2,'Z') RETURNING id`, [tenant, sp])).rows[0].id;
    sensorId = (await c.query<{ id: string }>(`INSERT INTO cc_sensor (tenant_id, cc_zone_id, vendor, external_id) VALUES ($1,$2,'conserv','X') RETURNING id`, [tenant, zoneId])).rows[0].id;
  });
});

afterAll(async () => {
  await pool.end();
});

describe('sustainability', () => {
  it('computes carbon from metered electricity', async () => {
    await withTenant(tenant, (c) => recordMeterReading(c, tenant, { meterId, value: 1000, ts: '2026-03-01T00:00:00Z' }));
    const carbon = await withTenant(tenant, (c) => carbonForBuilding(c, tenant, buildingId, '2026-01-01', '2026-12-31'));
    expect(carbon.tco2e).toBeGreaterThan(0); // 1000 kWh × ~0.226 → ~0.226 tCO2e
    expect(carbon.byUtility.elec).toBeGreaterThan(0);
  });

  it('computes Bizot compliance from RH telemetry', async () => {
    await withTenant(tenant, async (c) => {
      for (const v of [50, 52, 48, 70]) { // 3 of 4 in the 40–60 band
        await c.query(`INSERT INTO cc_reading (tenant_id, sensor_id, zone_id, metric, value, ts) VALUES ($1,$2,$3,'rh',$4, now())`, [tenant, sensorId, zoneId, v]);
      }
    });
    const r = await withTenant(tenant, (c) => computeBizotCompliance(c, tenant, zoneId, '2026', '2000-01-01', '2100-01-01'));
    expect(r.pctHoursInBand).toBeCloseTo(75, 0);
  });

  it('produces a SEAI M&R export', async () => {
    const out = await withTenant(tenant, (c) => seaiExport(c, tenant, 2026));
    expect(out.year).toBe(2026);
    expect(out.csv.split('\n')[0]).toBe('building,utility,total_consumption');
    expect(out.rows.length).toBeGreaterThanOrEqual(1);
  });
});
