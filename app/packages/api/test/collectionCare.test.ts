// EP-9 — collection-care engine hardening: multi-metric enforcement (rh/temp/lux/uv/co2),
// rate-of-change, excursion de-duplication, and the real WO-ref scheme.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pool } from '../src/db/pool.js';
import { withTenant } from '../src/db/withTenant.js';
import { createTenant } from './helpers/db.js';
import { evaluateReading } from '../src/domain/collectionCare.js';

let tenant: string;
let spaceId: string;

beforeAll(async () => {
  tenant = await createTenant('cc');
  await withTenant(tenant, async (c) => {
    const site = (await c.query<{ id: string }>(`INSERT INTO est_site (tenant_id, name) VALUES ($1,'S') RETURNING id`, [tenant])).rows[0].id;
    const b = (await c.query<{ id: string }>(`INSERT INTO est_building (tenant_id, site_id, name) VALUES ($1,$2,'B') RETURNING id`, [tenant, site])).rows[0].id;
    const f = (await c.query<{ id: string }>(`INSERT INTO est_floor (tenant_id, building_id, name) VALUES ($1,$2,'F') RETURNING id`, [tenant, b])).rows[0].id;
    spaceId = (await c.query<{ id: string }>(`INSERT INTO est_space (tenant_id, floor_id, name, space_type, is_collection_zone) VALUES ($1,$2,'G','gallery',true) RETURNING id`, [tenant, f])).rows[0].id;
  });
});

afterAll(async () => {
  await pool.end();
});

/** A fresh monitored zone with a fully-specified target + sensor (isolates dedup per test). */
async function makeZone(): Promise<{ zoneId: string; sensorId: string }> {
  return withTenant(tenant, async (c) => {
    const zoneId = (await c.query<{ id: string }>(`INSERT INTO cc_zone (tenant_id, space_id, name) VALUES ($1,$2,'Z') RETURNING id`, [tenant, spaceId])).rows[0].id;
    const std = (await c.query<{ id: string }>(`SELECT id FROM cc_standard WHERE code='ASHRAE_A'`)).rows[0].id;
    await c.query(
      `INSERT INTO cc_zone_target (tenant_id, cc_zone_id, cc_standard_id, temp_min, temp_max, rh_min, rh_max, rh_rate_max_per_24h, lux_max, uv_max_uw_per_lm, co2_max_ppm)
       VALUES ($1,$2,$3, 18,22, 45,55, 5, 50, 75, 1000)`,
      [tenant, zoneId, std],
    );
    const sensorId = (await c.query<{ id: string }>(`INSERT INTO cc_sensor (tenant_id, cc_zone_id, vendor, external_id, metrics) VALUES ($1,$2,'conserv','X','{temp,rh,lux,uv,co2}') RETURNING id`, [tenant, zoneId])).rows[0].id;
    return { zoneId, sensorId };
  });
}

const evalReading = (sensorId: string, zoneId: string, metric: string, value: number, ts?: string) =>
  withTenant(tenant, (c) => evaluateReading(c, tenant, { sensorId, zoneId, metric: metric as any, value, ts }));

describe('collection-care engine', () => {
  it('does not breach within band', async () => {
    const z = await makeZone();
    const r = await evalReading(z.sensorId, z.zoneId, 'rh', 50);
    expect(r.breach).toBe(false);
  });

  it('raises an RH absolute excursion with a real WO ref', async () => {
    const z = await makeZone();
    const r = await evalReading(z.sensorId, z.zoneId, 'rh', 70);
    expect(r.breach).toBe(true);
    expect(r.severity).toBe('critical');
    expect(r.kind).toBe('absolute');
    expect(r.workOrderRef).toMatch(/^WO-\d{4}-\d{5}$/);
  });

  it('enforces a temperature band', async () => {
    const z = await makeZone();
    const r = await evalReading(z.sensorId, z.zoneId, 'temp', 30);
    expect(r.breach).toBe(true);
    expect(r.kind).toBe('absolute');
  });

  it('enforces lux, uv and co2 ceilings', async () => {
    for (const [metric, value] of [['lux', 100], ['uv', 200], ['co2', 2000]] as const) {
      const z = await makeZone();
      const r = await evalReading(z.sensorId, z.zoneId, metric, value);
      expect(r.breach, `${metric} should breach`).toBe(true);
    }
  });

  it('detects a rate-of-change excursion within the absolute band', async () => {
    const z = await makeZone();
    const twoHoursAgo = new Date(Date.now() - 2 * 3_600_000).toISOString();
    await withTenant(tenant, (c) =>
      c.query(`INSERT INTO cc_reading (tenant_id, sensor_id, zone_id, metric, value, ts) VALUES ($1,$2,$3,'rh',46,$4)`, [tenant, z.sensorId, z.zoneId, twoHoursAgo]),
    );
    const r = await evalReading(z.sensorId, z.zoneId, 'rh', 54); // within [45,55] but an 8%/2h swing
    expect(r.breach).toBe(true);
    expect(r.kind).toBe('rate_of_change');
  });

  it('de-duplicates: a re-breach of an open excursion raises no second work order', async () => {
    const z = await makeZone();
    const first = await evalReading(z.sensorId, z.zoneId, 'rh', 70);
    const second = await evalReading(z.sensorId, z.zoneId, 'rh', 72);
    expect(first.breach).toBe(true);
    expect(second.breach).toBe(true);
    expect(second.excursionId).toBe(first.excursionId);
    const wos = await withTenant(tenant, (c) =>
      c.query<{ n: number }>(`SELECT count(*)::int AS n FROM wo_work_order WHERE source='excursion' AND cc_excursion_id = $1`, [first.excursionId]),
    );
    expect(wos.rows[0].n).toBe(1);
  });
});
