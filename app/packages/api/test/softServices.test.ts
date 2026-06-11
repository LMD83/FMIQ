// P2 — soft services + IPM: QR completion + pest-near-collections escalation.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pool } from '../src/db/pool.js';
import { withTenant } from '../src/db/withTenant.js';
import { createTenant } from './helpers/db.js';
import { completeSoftTask, recordIpmObservation, recordWaste } from '../src/domain/softServices.js';

let tenant: string;
let collectionZoneSpace: string;
let officeSpace: string;

beforeAll(async () => {
  tenant = await createTenant('soft');
  await withTenant(tenant, async (c) => {
    const site = (await c.query<{ id: string }>(`INSERT INTO est_site (tenant_id, name) VALUES ($1,'S') RETURNING id`, [tenant])).rows[0].id;
    const b = (await c.query<{ id: string }>(`INSERT INTO est_building (tenant_id, site_id, name) VALUES ($1,$2,'B') RETURNING id`, [tenant, site])).rows[0].id;
    const f = (await c.query<{ id: string }>(`INSERT INTO est_floor (tenant_id, building_id, name) VALUES ($1,$2,'F') RETURNING id`, [tenant, b])).rows[0].id;
    collectionZoneSpace = (await c.query<{ id: string }>(`INSERT INTO est_space (tenant_id, floor_id, name, space_type, is_collection_zone) VALUES ($1,$2,'Store','store',true) RETURNING id`, [tenant, f])).rows[0].id;
    officeSpace = (await c.query<{ id: string }>(`INSERT INTO est_space (tenant_id, floor_id, name, space_type, is_collection_zone) VALUES ($1,$2,'Office','office',false) RETURNING id`, [tenant, f])).rows[0].id;
  });
});

afterAll(async () => {
  await pool.end();
});

async function makeTrap(spaceId: string): Promise<string> {
  return withTenant(tenant, async (c) =>
    (await c.query<{ id: string }>(`INSERT INTO ipm_trap (tenant_id, space_id, code) VALUES ($1,$2,$3) RETURNING id`, [tenant, spaceId, `T-${Math.random().toString(36).slice(2, 6)}`])).rows[0].id,
  );
}

describe('soft services', () => {
  it('QR scan marks the completion location-verified', async () => {
    const task = await withTenant(tenant, async (c) =>
      (await c.query<{ id: string }>(`INSERT INTO soft_task (tenant_id, space_id) VALUES ($1,$2) RETURNING id`, [tenant, officeSpace])).rows[0].id,
    );
    const r = await withTenant(tenant, (c) => completeSoftTask(c, tenant, { taskId: task, qrScan: true }));
    expect(r.locationVerified).toBe(true);
  });

  it('records waste', async () => {
    const r = await withTenant(tenant, (c) => recordWaste(c, tenant, { stream: 'mixed_recycling', weightKg: 12, recycled: true }));
    expect(r.id).toBeDefined();
  });
});

describe('IPM escalation', () => {
  it('escalates a sighting in a collection zone to the Conservation Officer', async () => {
    const trap = await makeTrap(collectionZoneSpace);
    const r = await withTenant(tenant, (c) => recordIpmObservation(c, tenant, { trapId: trap, species: 'webbing clothes moth', count: 3, materialRisk: 'textile' }));
    expect(r.escalated).toBe(true);
    const notif = await withTenant(tenant, (c) => c.query<{ n: number }>(`SELECT count(*)::int AS n FROM ntf_message WHERE entity_type = 'ipm_observation' AND entity_id = $1`, [r.id]));
    expect(notif.rows[0].n).toBe(1);
  });

  it('does not escalate a sighting outside a collection zone', async () => {
    const trap = await makeTrap(officeSpace);
    const r = await withTenant(tenant, (c) => recordIpmObservation(c, tenant, { trapId: trap, species: 'silverfish', count: 2 }));
    expect(r.escalated).toBe(false);
  });

  it('does not escalate a zero-count check even in a collection zone', async () => {
    const trap = await makeTrap(collectionZoneSpace);
    const r = await withTenant(tenant, (c) => recordIpmObservation(c, tenant, { trapId: trap, species: 'none', count: 0 }));
    expect(r.escalated).toBe(false);
  });
});
