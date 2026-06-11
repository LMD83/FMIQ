// Work-order ref scheme + gate-enforced state machine (EP-6 slice / gate wiring).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pool } from '../src/db/pool.js';
import { withTenant } from '../src/db/withTenant.js';
import { createTenant } from './helpers/db.js';
import { closeWorkOrder, nextRef, transitionWorkOrder, GateBlockedError } from '../src/domain/workOrders.js';
import { overrideGate } from '../src/domain/gateEngine.js';

let tenant: string;
let spaceId: string;
let userId: string;

beforeAll(async () => {
  tenant = await createTenant('wo');
  await withTenant(tenant, async (c) => {
    const site = (await c.query<{ id: string }>(`INSERT INTO est_site (tenant_id, name) VALUES ($1,'S') RETURNING id`, [tenant])).rows[0].id;
    const b = (await c.query<{ id: string }>(`INSERT INTO est_building (tenant_id, site_id, name) VALUES ($1,$2,'B') RETURNING id`, [tenant, site])).rows[0].id;
    const f = (await c.query<{ id: string }>(`INSERT INTO est_floor (tenant_id, building_id, name) VALUES ($1,$2,'F') RETURNING id`, [tenant, b])).rows[0].id;
    spaceId = (await c.query<{ id: string }>(`INSERT INTO est_space (tenant_id, floor_id, name, space_type) VALUES ($1,$2,'Sp','plant') RETURNING id`, [tenant, f])).rows[0].id;
    userId = (await c.query<{ id: string }>(`INSERT INTO core_user (tenant_id, email, display_name) VALUES ($1,'t@test.local','T') RETURNING id`, [tenant])).rows[0].id;
  });
});

afterAll(async () => {
  await pool.end();
});

interface WOOpts { status?: string; assignee?: boolean; contractor?: 'none' | 'valid' | 'expired'; }
async function makeWO(o: WOOpts = {}): Promise<string> {
  return withTenant(tenant, async (c) => {
    let contractorId: string | null = null;
    if (o.contractor === 'valid' || o.contractor === 'expired') {
      const exp = o.contractor === 'valid' ? `current_date + interval '1 year'` : `current_date - interval '1 day'`;
      contractorId = (await c.query<{ id: string }>(`INSERT INTO wo_contractor (tenant_id, name, insurance_expiry) VALUES ($1,'C',${exp}) RETURNING id`, [tenant])).rows[0].id;
    }
    const ref = await nextRef(c, tenant);
    return (await c.query<{ id: string }>(
      `INSERT INTO wo_work_order (tenant_id, ref, space_id, source, title, status, assignee_id, contractor_id)
       VALUES ($1,$2,$3,'reactive','t',$4,$5,$6) RETURNING id`,
      [tenant, ref, spaceId, o.status ?? 'assigned', o.assignee ? userId : null, contractorId],
    )).rows[0].id;
  });
}

const move = (id: string, status: 'open' | 'assigned' | 'in_progress' | 'closed') =>
  withTenant(tenant, (c) => transitionWorkOrder(c, tenant, { workOrderId: id, toStatus: status, actorUserId: userId }));

describe('nextRef', () => {
  it('produces sequential, zero-padded, per-tenant refs', async () => {
    const a = await withTenant(tenant, (c) => nextRef(c, tenant, 'test_seq'));
    const b = await withTenant(tenant, (c) => nextRef(c, tenant, 'test_seq'));
    expect(a).toMatch(/^WO-\d{4}-\d{5}$/);
    const na = Number(a.split('-')[2]);
    const nb = Number(b.split('-')[2]);
    expect(nb).toBe(na + 1);
  });

  it('counters are isolated per tenant', async () => {
    const other = await createTenant('wo-other');
    const first = await withTenant(other, (c) => nextRef(c, other, 'work_order'));
    expect(first.endsWith('00001')).toBe(true);
  });
});

describe('transitionWorkOrder', () => {
  it('allows a valid ungated transition (open → assigned)', async () => {
    const wo = await makeWO({ status: 'open' });
    const r = await move(wo, 'assigned');
    expect(r.from).toBe('open');
    expect(r.to).toBe('assigned');
  });

  it('rejects an invalid transition (open → in_progress)', async () => {
    const wo = await makeWO({ status: 'open', assignee: true });
    await expect(move(wo, 'in_progress')).rejects.toMatchObject({ code: 'invalid_transition' });
  });

  it('404s an unknown work order', async () => {
    await expect(move('00000000-0000-0000-0000-0000000000ff', 'assigned')).rejects.toMatchObject({ code: 'not_found' });
  });

  it('runs the SSoW gate on → in_progress and allows when green', async () => {
    const wo = await makeWO({ status: 'assigned', assignee: true, contractor: 'none' });
    const r = await move(wo, 'in_progress');
    expect(r.to).toBe('in_progress');
    expect(r.gate?.blocked).toBe(false);
  });

  it('HARD-blocks → in_progress when the gate fails', async () => {
    const wo = await makeWO({ status: 'assigned', assignee: true, contractor: 'expired' });
    await expect(move(wo, 'in_progress')).rejects.toBeInstanceOf(GateBlockedError);
  });

  it('proceeds → in_progress after a documented override of the blocking checks', async () => {
    const wo = await makeWO({ status: 'assigned', assignee: true, contractor: 'expired' });
    await expect(move(wo, 'in_progress')).rejects.toBeInstanceOf(GateBlockedError);
    await withTenant(tenant, (c) =>
      overrideGate(c, tenant, { gateCode: 'ssow_readiness', workOrderId: wo }, {
        overrideBy: userId,
        reason: 'Broker confirmed cover is continuous; renewal paperwork pending.',
        actorRoles: ['FacilitiesManager'],
      }),
    );
    const r = await move(wo, 'in_progress');
    expect(r.to).toBe('in_progress');
  });

  it('sets closed_at on close', async () => {
    const wo = await makeWO({ status: 'assigned' });
    await move(wo, 'closed');
    const row = await withTenant(tenant, (c) => c.query<{ closed_at: string | null }>(`SELECT closed_at FROM wo_work_order WHERE id = $1`, [wo]));
    expect(row.rows[0].closed_at).not.toBeNull();
  });

  it('is a no-op when already in the target status', async () => {
    const wo = await makeWO({ status: 'assigned' });
    const r = await move(wo, 'assigned');
    expect(r.from).toBe('assigned');
    expect(r.to).toBe('assigned');
  });
});

describe('closeWorkOrder (failure coding)', () => {
  it('requires a failure mode', async () => {
    const wo = await makeWO({ status: 'assigned' });
    await expect(
      withTenant(tenant, (c) => closeWorkOrder(c, tenant, { workOrderId: wo, failureMode: '  ', actorUserId: userId })),
    ).rejects.toMatchObject({ code: 'missing_fields' });
  });

  it('records failure codes and closes', async () => {
    const wo = await makeWO({ status: 'assigned' });
    const r = await withTenant(tenant, (c) => closeWorkOrder(c, tenant, { workOrderId: wo, failureMode: 'bearing_wear', failureCause: 'age', failureRemedy: 'replaced', actorUserId: userId }));
    expect(r.to).toBe('closed');
    const row = await withTenant(tenant, (c) => c.query<{ failure_mode: string; closed_at: string | null; confirmed_by: string | null }>(`SELECT failure_mode, closed_at, confirmed_by FROM wo_work_order WHERE id = $1`, [wo]));
    expect(row.rows[0].failure_mode).toBe('bearing_wear');
    expect(row.rows[0].closed_at).not.toBeNull();
    expect(row.rows[0].confirmed_by).toBe(userId);
  });
});
