// Revenue eTax Clearance — gate check + recording (S.I. 463/2012).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pool } from '../src/db/pool.js';
import { withTenant } from '../src/db/withTenant.js';
import { createTenant } from './helpers/db.js';
import { evaluateGates } from '../src/domain/gateEngine.js';
import { recordTaxClearance, verifyAndRecord } from '../src/domain/taxClearance.js';

let tenant: string;
let spaceId: string;
let userId: string;

beforeAll(async () => {
  tenant = await createTenant('tax');
  await withTenant(tenant, async (c) => {
    const site = (await c.query<{ id: string }>(`INSERT INTO est_site (tenant_id, name) VALUES ($1,'S') RETURNING id`, [tenant])).rows[0].id;
    const b = (await c.query<{ id: string }>(`INSERT INTO est_building (tenant_id, site_id, name) VALUES ($1,$2,'B') RETURNING id`, [tenant, site])).rows[0].id;
    const f = (await c.query<{ id: string }>(`INSERT INTO est_floor (tenant_id, building_id, name) VALUES ($1,$2,'F') RETURNING id`, [tenant, b])).rows[0].id;
    spaceId = (await c.query<{ id: string }>(`INSERT INTO est_space (tenant_id, floor_id, name, space_type) VALUES ($1,$2,'P','plant') RETURNING id`, [tenant, f])).rows[0].id;
    userId = (await c.query<{ id: string }>(`INSERT INTO core_user (tenant_id, email, display_name) VALUES ($1,'a@test.local','A') RETURNING id`, [tenant])).rows[0].id;
  });
});

afterAll(async () => {
  await pool.end();
});

async function woWithContractor(status: string | null): Promise<{ woId: string; contractorId: string }> {
  return withTenant(tenant, async (c) => {
    const contractorId = (await c.query<{ id: string }>(
      `INSERT INTO wo_contractor (tenant_id, name, insurance_expiry, tax_clearance_status) VALUES ($1,'C', current_date + interval '1 year', $2) RETURNING id`,
      [tenant, status],
    )).rows[0].id;
    const woId = (await c.query<{ id: string }>(
      `INSERT INTO wo_work_order (tenant_id, ref, space_id, source, title, status, assignee_id, contractor_id)
       VALUES ($1,$2,$3,'reactive','t','assigned',$4,$5) RETURNING id`,
      [tenant, `WO-${Math.random().toString(36).slice(2, 9)}`, spaceId, userId, contractorId],
    )).rows[0].id;
    return { woId, contractorId };
  });
}

const evalGate = (woId: string) => withTenant(tenant, (c) => evaluateGates(c, tenant, { gateCode: 'ssow_readiness', workOrderId: woId }, { persist: false }));

describe('eTax clearance gate', () => {
  it('blocks a contractor whose tax clearance is revoked', async () => {
    const { woId } = await woWithContractor('revoked');
    expect((await evalGate(woId)).blockedBy.map((x) => x.checkId)).toContain('tax_clearance_valid');
  });

  it('passes a tax-compliant contractor', async () => {
    const { woId } = await woWithContractor('valid');
    expect((await evalGate(woId)).results.find((x) => x.checkId === 'tax_clearance_valid')!.passed).toBe(true);
  });

  it('passes when status is unknown / not yet checked (does not hard-block before first check)', async () => {
    const { woId } = await woWithContractor(null);
    expect((await evalGate(woId)).results.find((x) => x.checkId === 'tax_clearance_valid')!.passed).toBe(true);
  });

  it('records a verification result and re-evaluates to blocked', async () => {
    const { woId, contractorId } = await woWithContractor(null);
    await withTenant(tenant, (c) => recordTaxClearance(c, tenant, contractorId, 'expired'));
    expect((await evalGate(woId)).blockedBy.map((x) => x.checkId)).toContain('tax_clearance_valid');
    const audit = await withTenant(tenant, (c) => c.query<{ n: number }>(`SELECT count(*)::int AS n FROM core_audit_log WHERE entity_id = $1 AND action = 'tax_clearance.checked'`, [contractorId]));
    expect(audit.rows[0].n).toBe(1);
  });

  it('verifyAndRecord with no TCAN yields unknown', async () => {
    const { contractorId } = await woWithContractor(null);
    const status = await withTenant(tenant, (c) => verifyAndRecord(c, tenant, contractorId));
    expect(status).toBe('unknown');
  });
});
