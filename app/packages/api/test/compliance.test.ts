// S7 — compliance certificates + escalating alerts + inspection→remedial-WO loop.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pool } from '../src/db/pool.js';
import { withTenant } from '../src/db/withTenant.js';
import { createTenant } from './helpers/db.js';
import { certsDueForAlert, createCertificate, expiryTier, recordInspection } from '../src/domain/compliance.js';

let tenant: string;
let buildingId: string;
let spaceId: string;

beforeAll(async () => {
  tenant = await createTenant('cmp');
  await withTenant(tenant, async (c) => {
    const site = (await c.query<{ id: string }>(`INSERT INTO est_site (tenant_id, name) VALUES ($1,'S') RETURNING id`, [tenant])).rows[0].id;
    buildingId = (await c.query<{ id: string }>(`INSERT INTO est_building (tenant_id, site_id, name) VALUES ($1,$2,'B') RETURNING id`, [tenant, site])).rows[0].id;
    const f = (await c.query<{ id: string }>(`INSERT INTO est_floor (tenant_id, building_id, name) VALUES ($1,$2,'F') RETURNING id`, [tenant, buildingId])).rows[0].id;
    spaceId = (await c.query<{ id: string }>(`INSERT INTO est_space (tenant_id, floor_id, name, space_type) VALUES ($1,$2,'P','plant') RETURNING id`, [tenant, f])).rows[0].id;
  });
});

afterAll(async () => {
  await pool.end();
});

describe('expiry tiers', () => {
  it('maps days-until to the soonest alert tier', () => {
    expect(expiryTier(120)).toBeNull();
    expect(expiryTier(85)).toBe(90);
    expect(expiryTier(45)).toBe(60);
    expect(expiryTier(20)).toBe(30);
    expect(expiryTier(5)).toBe(7);
  });
});

describe('certificate register', () => {
  it('surfaces certificates due for alert at the right tier', async () => {
    const in20 = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10);
    const in200 = new Date(Date.now() + 200 * 86_400_000).toISOString().slice(0, 10);
    const due = await withTenant(tenant, (c) => createCertificate(c, tenant, { certTypeCode: 'fire_alarm', ref: 'FA-1', expiryDate: in20, buildingId }));
    await withTenant(tenant, (c) => createCertificate(c, tenant, { certTypeCode: 'electrical', ref: 'EL-1', expiryDate: in200, buildingId }));

    const alerts = await withTenant(tenant, (c) => certsDueForAlert(c, tenant));
    const hit = alerts.find((a) => a.id === due.id);
    expect(hit).toBeDefined();
    expect(hit!.tier).toBe(30);
    expect(alerts.some((a) => a.ref === 'EL-1')).toBe(false); // 200 days out — not yet
  });
});

describe('inspections', () => {
  it('all-pass inspection raises no remedial work order', async () => {
    const r = await withTenant(tenant, (c) => recordInspection(c, tenant, { spaceId, items: [{ label: 'Panel', pass: true }, { label: 'Battery', pass: true }] }));
    expect(r.passed).toBe(true);
    expect(r.remedialWorkOrderId).toBeUndefined();
  });

  it('a failed item auto-creates a defect and a remedial work order', async () => {
    const r = await withTenant(tenant, (c) => recordInspection(c, tenant, { spaceId, items: [{ label: 'Panel', pass: true }, { label: 'Sounder', pass: false, note: 'no sound' }] }));
    expect(r.passed).toBe(false);
    expect(r.remedialWorkOrderId).toBeDefined();
    expect(r.defectId).toBeDefined();
    const wo = await withTenant(tenant, (c) => c.query<{ source: string; status: string }>(`SELECT source, status FROM wo_work_order WHERE id = $1`, [r.remedialWorkOrderId]));
    expect(wo.rows[0].source).toBe('inspection');
    const items = await withTenant(tenant, (c) => c.query<{ n: number }>(`SELECT count(*)::int AS n FROM cmp_inspection_item WHERE inspection_id = $1`, [r.inspectionId]));
    expect(items.rows[0].n).toBe(2);
  });
});
