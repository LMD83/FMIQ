// GOV-71 — gate engine unit tests. Covers every check (pass/fail), the override
// path (allowed / forbidden / no-reason), config-driven mode + on-block, audit and
// snapshot side-effects, and the unknown-gate / missing-work-order edges.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pool } from '../src/db/pool.js';
import { withTenant } from '../src/db/withTenant.js';
import { createTenant } from './helpers/db.js';
import {
  evaluateGates,
  evaluateWorkOrderGate,
  overrideGate,
  GateError,
  GATE_REGISTRY,
} from '../src/domain/gateEngine.js';

let tenant: string;
let spaceId: string;
let userId: string;

beforeAll(async () => {
  tenant = await createTenant('gate-tenant');
  await withTenant(tenant, async (c) => {
    const site = (await c.query<{ id: string }>(`INSERT INTO est_site (tenant_id, name) VALUES ($1, 'S') RETURNING id`, [tenant])).rows[0].id;
    const b = (await c.query<{ id: string }>(`INSERT INTO est_building (tenant_id, site_id, name) VALUES ($1, $2, 'B') RETURNING id`, [tenant, site])).rows[0].id;
    const f = (await c.query<{ id: string }>(`INSERT INTO est_floor (tenant_id, building_id, name) VALUES ($1, $2, 'F') RETURNING id`, [tenant, b])).rows[0].id;
    spaceId = (await c.query<{ id: string }>(`INSERT INTO est_space (tenant_id, floor_id, name, space_type) VALUES ($1, $2, 'Sp', 'plant') RETURNING id`, [tenant, f])).rows[0].id;
    userId = (await c.query<{ id: string }>(`INSERT INTO core_user (tenant_id, email, display_name) VALUES ($1, 'tech@test.local', 'Tech') RETURNING id`, [tenant])).rows[0].id;
  });
});

afterAll(async () => {
  await pool.end();
});

interface WOOpts {
  status?: string;
  assignee?: boolean;
  contractor?: 'none' | 'valid' | 'expired';
}

async function makeWO(o: WOOpts = {}): Promise<string> {
  return withTenant(tenant, async (c) => {
    let contractorId: string | null = null;
    if (o.contractor === 'valid' || o.contractor === 'expired') {
      const expiry = o.contractor === 'valid' ? `current_date + interval '1 year'` : `current_date - interval '1 day'`;
      contractorId = (
        await c.query<{ id: string }>(
          `INSERT INTO wo_contractor (tenant_id, name, insurance_expiry) VALUES ($1, 'C', ${expiry}) RETURNING id`,
          [tenant],
        )
      ).rows[0].id;
    }
    const ref = `WO-${Math.random().toString(36).slice(2, 9)}`;
    return (
      await c.query<{ id: string }>(
        `INSERT INTO wo_work_order (tenant_id, ref, space_id, source, title, status, assignee_id, contractor_id)
         VALUES ($1, $2, $3, 'reactive', 'test', $4, $5, $6) RETURNING id`,
        [tenant, ref, spaceId, o.status ?? 'assigned', o.assignee ? userId : null, contractorId],
      )
    ).rows[0].id;
  });
}

function evalGate(workOrderId: string, gateCode = 'ssow_readiness') {
  return withTenant(tenant, (c) => evaluateGates(c, tenant, { gateCode, workOrderId }));
}

describe('gate engine — ssow_readiness checks', () => {
  it('passes when assigned in-house with no contractor', async () => {
    const r = await evalGate(await makeWO({ status: 'assigned', assignee: true, contractor: 'none' }));
    expect(r.allPassed).toBe(true);
    expect(r.satisfied).toBe(true);
    expect(r.blocked).toBe(false);
    expect(r.firstBlockMessage).toBeUndefined();
  });

  it('passes with a contractor whose insurance is in date (contractor satisfies assignee check)', async () => {
    const r = await evalGate(await makeWO({ assignee: false, contractor: 'valid' }));
    expect(r.results.find((x) => x.checkId === 'assignee_present')!.passed).toBe(true);
    expect(r.results.find((x) => x.checkId === 'contractor_insurance_valid')!.passed).toBe(true);
    expect(r.blocked).toBe(false);
  });

  it('HARD-blocks when contractor insurance is expired', async () => {
    const r = await evalGate(await makeWO({ assignee: true, contractor: 'expired' }));
    expect(r.allPassed).toBe(false);
    expect(r.blocked).toBe(true);
    expect(r.blockedBy.map((x) => x.checkId)).toContain('contractor_insurance_valid');
    expect(r.firstBlockMessage).toBeTruthy();
  });

  it('blocks when the work order is already closed', async () => {
    const r = await evalGate(await makeWO({ status: 'closed', assignee: true }));
    expect(r.blockedBy.map((x) => x.checkId)).toContain('not_closed');
    expect(r.blocked).toBe(true);
  });

  it('blocks when nobody is assigned', async () => {
    const r = await evalGate(await makeWO({ assignee: false, contractor: 'none' }));
    expect(r.blockedBy.map((x) => x.checkId)).toContain('assignee_present');
    expect(r.blocked).toBe(true);
  });

  it('fails work_order_exists for an unknown work order and writes no snapshot', async () => {
    const fake = '00000000-0000-0000-0000-0000000000ff';
    const r = await evalGate(fake);
    expect(r.results.find((x) => x.checkId === 'work_order_exists')!.passed).toBe(false);
    expect(r.blocked).toBe(true);
    const snaps = await withTenant(tenant, (c) =>
      c.query<{ n: number }>(`SELECT count(*)::int AS n FROM wo_gate_check WHERE work_order_id = $1`, [fake]),
    );
    expect(snaps.rows[0].n).toBe(0);
  });

  it('records a wo_gate_check snapshot per check and a gate audit entry', async () => {
    const wo = await makeWO({ assignee: true, contractor: 'valid' });
    await evalGate(wo);
    const snaps = await withTenant(tenant, (c) =>
      c.query(`SELECT check_id, status FROM wo_gate_check WHERE work_order_id = $1`, [wo]),
    );
    expect(snaps.rowCount).toBe(GATE_REGISTRY.ssow_readiness.length);
    const audit = await withTenant(tenant, (c) =>
      c.query(`SELECT action FROM core_audit_log WHERE entity_id = $1 AND action LIKE 'gate.%'`, [wo]),
    );
    expect(audit.rowCount).toBeGreaterThanOrEqual(1);
  });

  it('throws on an unknown gate code', async () => {
    await expect(evalGate(await makeWO({ assignee: true }), 'does_not_exist')).rejects.toBeInstanceOf(GateError);
  });

  it('evaluateWorkOrderGate wraps evaluation in its own transaction', async () => {
    const r = await evaluateWorkOrderGate(tenant, {
      gateCode: 'ssow_readiness',
      workOrderId: await makeWO({ assignee: true, contractor: 'valid' }),
    });
    expect(r.allPassed).toBe(true);
  });
});

describe('gate engine — configuration from gate_definition', () => {
  it('ANY mode + SOFT on-block: satisfied and not blocked despite a failing check', async () => {
    await withTenant(tenant, (c) =>
      c.query(
        `INSERT INTO gate_definition (tenant_id, code, name, mode, on_block) VALUES ($1, 'ssow_readiness', 'SSoW', 'ANY', 'SOFT')
         ON CONFLICT (tenant_id, code) DO UPDATE SET mode = 'ANY', on_block = 'SOFT', active = true`,
        [tenant],
      ),
    );
    const r = await evalGate(await makeWO({ assignee: true, contractor: 'expired' }));
    expect(r.mode).toBe('ANY');
    expect(r.onBlock).toBe('SOFT');
    expect(r.satisfied).toBe(true);
    expect(r.blocked).toBe(false);
    // restore defaults (still a row present, override_roles empty → engine default roles)
    await withTenant(tenant, (c) =>
      c.query(`UPDATE gate_definition SET mode = 'ALL', on_block = 'HARD' WHERE tenant_id = $1 AND code = 'ssow_readiness'`, [tenant]),
    );
  });
});

describe('gate engine — override', () => {
  it('lets an authorised role override a blocked gate with a reason', async () => {
    const wo = await makeWO({ assignee: true, contractor: 'expired' });
    const res = await withTenant(tenant, (c) =>
      overrideGate(
        c,
        tenant,
        { gateCode: 'ssow_readiness', workOrderId: wo },
        { overrideBy: userId, reason: 'Insurance renewal confirmed by broker; cover continuous.', actorRoles: ['FacilitiesManager'] },
      ),
    );
    expect(res.overridden).toBe(true);
    expect(res.overriddenChecks).toContain('contractor_insurance_valid');
    const ov = await withTenant(tenant, (c) =>
      c.query<{ n: number }>(`SELECT count(*)::int AS n FROM wo_gate_check WHERE work_order_id = $1 AND status = 'override'`, [wo]),
    );
    expect(ov.rows[0].n).toBeGreaterThanOrEqual(1);
    const audit = await withTenant(tenant, (c) =>
      c.query<{ n: number }>(`SELECT count(*)::int AS n FROM core_audit_log WHERE entity_id = $1 AND action = 'gate.overridden'`, [wo]),
    );
    expect(audit.rows[0].n).toBe(1);
  });

  it('refuses an override from a role without permission', async () => {
    const wo = await makeWO({ assignee: true, contractor: 'expired' });
    await expect(
      withTenant(tenant, (c) =>
        overrideGate(c, tenant, { gateCode: 'ssow_readiness', workOrderId: wo }, { overrideBy: userId, reason: 'x', actorRoles: ['ReadOnly'] }),
      ),
    ).rejects.toMatchObject({ code: 'override_forbidden' });
  });

  it('requires a non-empty reason', async () => {
    const wo = await makeWO({ assignee: true, contractor: 'expired' });
    await expect(
      withTenant(tenant, (c) =>
        overrideGate(c, tenant, { gateCode: 'ssow_readiness', workOrderId: wo }, { overrideBy: userId, reason: '   ', actorRoles: ['TenantAdmin'] }),
      ),
    ).rejects.toMatchObject({ code: 'override_reason_required' });
  });

  it('throws on override of an unknown gate code', async () => {
    await expect(
      withTenant(tenant, (c) =>
        overrideGate(
          c,
          tenant,
          { gateCode: 'nope', workOrderId: '00000000-0000-0000-0000-0000000000ff' },
          { overrideBy: userId, reason: 'x', actorRoles: ['SystemAdmin'] },
        ),
      ),
    ).rejects.toMatchObject({ code: 'unknown_gate' });
  });
});
