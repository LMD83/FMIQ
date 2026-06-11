// S12 — role dashboard aggregates.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pool } from '../src/db/pool.js';
import { withTenant } from '../src/db/withTenant.js';
import { createTenant } from './helpers/db.js';
import { opsSummary, statutoryPpmCompliance } from '../src/domain/dashboards.js';

let tenant: string;

beforeAll(async () => {
  tenant = await createTenant('dash');
  await withTenant(tenant, async (c) => {
    const site = (await c.query<{ id: string }>(`INSERT INTO est_site (tenant_id, name) VALUES ($1,'S') RETURNING id`, [tenant])).rows[0].id;
    const b = (await c.query<{ id: string }>(`INSERT INTO est_building (tenant_id, site_id, name) VALUES ($1,$2,'B') RETURNING id`, [tenant, site])).rows[0].id;
    // open WO
    await c.query(`INSERT INTO wo_work_order (tenant_id, ref, source, title, status) VALUES ($1,'WO-D1','reactive','t','open')`, [tenant]);
    // cert expiring within 90d
    await c.query(`INSERT INTO cmp_certificate (tenant_id, cert_type_code, building_id, expiry_date) VALUES ($1,'fire_alarm',$2, current_date + interval '20 days')`, [tenant, b]);
    // a committed requisition
    const req = (await c.query<{ id: string }>(`INSERT INTO apr_requisition (tenant_id, amount_net, status) VALUES ($1, 2500, 'committed') RETURNING id`, [tenant])).rows[0].id;
    await c.query(`INSERT INTO apr_commitment (tenant_id, requisition_id, amount_net) VALUES ($1,$2,2500)`, [tenant, req]);
  });
});

afterAll(async () => {
  await pool.end();
});

describe('ops summary', () => {
  it('aggregates open WOs, expiring certs and committed spend', async () => {
    const s = await withTenant(tenant, (c) => opsSummary(c, tenant));
    expect(s.openWorkOrders).toBeGreaterThanOrEqual(1);
    expect(s.certsExpiringSoon).toBeGreaterThanOrEqual(1);
    expect(s.committedSpend).toBeGreaterThanOrEqual(2500);
  });

  it('statutory PPM compliance is 100% when nothing is overdue', async () => {
    expect(await withTenant(tenant, (c) => statutoryPpmCompliance(c, tenant))).toBe(100);
  });
});
