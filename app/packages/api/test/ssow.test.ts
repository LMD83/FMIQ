// S8–S9 — SSoW Readiness Gate: the gate engine wired to RAMS/permit/competency/
// pre-task/keys. Requirement flags on the WO drive which checks block.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pool } from '../src/db/pool.js';
import { withTenant } from '../src/db/withTenant.js';
import { createTenant } from './helpers/db.js';
import { evaluateGates } from '../src/domain/gateEngine.js';
import { addCompetency, approveRams, completePretask, contractorVault, createRams, issuePermit, signOutKey } from '../src/domain/ssow.js';

let tenant: string;
let spaceId: string;
let userId: string;

beforeAll(async () => {
  tenant = await createTenant('ssow');
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

interface WOReq { requiresRams?: boolean; permitType?: string | null; requiresKey?: boolean; contractor?: 'none' | 'valid' | 'expiredComp'; }
async function makeWO(req: WOReq = {}): Promise<{ woId: string; contractorId: string | null }> {
  return withTenant(tenant, async (c) => {
    let contractorId: string | null = null;
    if (req.contractor === 'valid' || req.contractor === 'expiredComp') {
      contractorId = (await c.query<{ id: string }>(`INSERT INTO wo_contractor (tenant_id, name, insurance_expiry) VALUES ($1,'C', current_date + interval '1 year') RETURNING id`, [tenant])).rows[0].id;
      if (req.contractor === 'expiredComp') {
        await c.query(`INSERT INTO hs_competency (tenant_id, contractor_id, comp_type, expiry) VALUES ($1,$2,'safe_pass', current_date - interval '1 day')`, [tenant, contractorId]);
      }
    }
    const ref = `WO-${Math.random().toString(36).slice(2, 9)}`;
    const woId = (await c.query<{ id: string }>(
      `INSERT INTO wo_work_order (tenant_id, ref, space_id, source, title, status, assignee_id, contractor_id, requires_rams, required_permit_type, requires_key)
       VALUES ($1,$2,$3,'reactive','t','assigned',$4,$5,$6,$7,$8) RETURNING id`,
      [tenant, ref, spaceId, userId, contractorId, req.requiresRams ?? false, req.permitType ?? null, req.requiresKey ?? false],
    )).rows[0].id;
    return { woId, contractorId };
  });
}

const evalGate = (woId: string) => withTenant(tenant, (c) => evaluateGates(c, tenant, { gateCode: 'ssow_readiness', workOrderId: woId }, { persist: false }));

describe('SSoW Readiness Gate', () => {
  it('a low-risk in-house job (no requirements) is ready', async () => {
    const { woId } = await makeWO();
    const r = await evalGate(woId);
    expect(r.blocked).toBe(false);
  });

  it('requires RAMS + pre-task when flagged, and clears once both are satisfied', async () => {
    const { woId } = await makeWO({ requiresRams: true });
    let r = await evalGate(woId);
    expect(r.blockedBy.map((x) => x.checkId)).toEqual(expect.arrayContaining(['rams_approved', 'pretask_complete']));

    const rams = await withTenant(tenant, (c) => createRams(c, tenant, { workOrderId: woId, title: 'Hot works RAMS' }));
    await withTenant(tenant, (c) => approveRams(c, tenant, rams.id, userId));
    await withTenant(tenant, (c) => completePretask(c, tenant, { workOrderId: woId, byUser: userId }));

    r = await evalGate(woId);
    expect(r.blocked).toBe(false);
  });

  it('requires an active permit of the named type', async () => {
    const { woId } = await makeWO({ permitType: 'hot_works' });
    expect((await evalGate(woId)).blockedBy.map((x) => x.checkId)).toContain('permit_active');
    await withTenant(tenant, (c) => issuePermit(c, tenant, { workOrderId: woId, permitType: 'hot_works', authoriserId: userId }));
    expect((await evalGate(woId)).blocked).toBe(false);
  });

  it('blocks on an expired contractor competency', async () => {
    const { woId } = await makeWO({ contractor: 'expiredComp' });
    expect((await evalGate(woId)).blockedBy.map((x) => x.checkId)).toContain('competencies_valid');
  });

  it('passes competency when the contractor has no expired certs', async () => {
    const { woId, contractorId } = await makeWO({ contractor: 'valid' });
    await withTenant(tenant, (c) => addCompetency(c, tenant, { contractorId, compType: 'safe_pass', expiry: new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10) }));
    const r = await evalGate(woId);
    expect(r.results.find((x) => x.checkId === 'competencies_valid')!.passed).toBe(true);
  });

  it('requires a signed-out key when flagged', async () => {
    const { woId } = await makeWO({ requiresKey: true });
    expect((await evalGate(woId)).blockedBy.map((x) => x.checkId)).toContain('keys_signed_out');
    const keyId = await withTenant(tenant, (c) => c.query<{ id: string }>(`INSERT INTO hs_key_register (tenant_id, code, name) VALUES ($1,'K','Key') RETURNING id`, [tenant]));
    await withTenant(tenant, (c) => signOutKey(c, tenant, { keyId: keyId.rows[0].id, workOrderId: woId, byUser: userId }));
    expect((await evalGate(woId)).blocked).toBe(false);
  });

  it('a new hazard on the pre-task keeps the job blocked', async () => {
    const { woId } = await makeWO({ requiresRams: true });
    const rams = await withTenant(tenant, (c) => createRams(c, tenant, { workOrderId: woId, title: 'R' }));
    await withTenant(tenant, (c) => approveRams(c, tenant, rams.id, userId));
    await withTenant(tenant, (c) => completePretask(c, tenant, { workOrderId: woId, byUser: userId, newHazard: true }));
    expect((await evalGate(woId)).blockedBy.map((x) => x.checkId)).toContain('pretask_complete');
  });
});

describe('Contractor compliance vault', () => {
  it('stores the vault document fields (reference, issued_on, verified)', async () => {
    const cid = (await withTenant(tenant, (c) => c.query<{ id: string }>(
      `INSERT INTO wo_contractor (tenant_id, name, prequal_status) VALUES ($1,'Acme Electrical','approved') RETURNING id`, [tenant],
    ))).rows[0].id;
    const { id } = await withTenant(tenant, (c) => addCompetency(c, tenant, {
      contractorId: cid, compType: 'reci', reference: 'RECI-12345',
      issuedOn: '2025-01-01', expiry: '2099-01-01', verified: true,
    }));
    const row = (await withTenant(tenant, (c) => c.query(
      `SELECT reference, issued_on, verified FROM hs_competency WHERE id = $1`, [id],
    ))).rows[0] as { reference: string; verified: boolean };
    expect(row.reference).toBe('RECI-12345');
    expect(row.verified).toBe(true);
  });

  it('aggregates valid vs expired documents per contractor', async () => {
    const cid = (await withTenant(tenant, (c) => c.query<{ id: string }>(
      `INSERT INTO wo_contractor (tenant_id, name) VALUES ($1,'Vault Co') RETURNING id`, [tenant],
    ))).rows[0].id;
    await withTenant(tenant, async (c) => {
      await addCompetency(c, tenant, { contractorId: cid, compType: 'safe_pass', expiry: '2099-01-01' });
      await addCompetency(c, tenant, { contractorId: cid, compType: 'public_liability', expiry: '2000-01-01' });
    });
    const vault = await withTenant(tenant, (c) => contractorVault(c, tenant));
    const row = vault.find((v) => v.id === cid)!;
    expect(row.total_docs).toBe(2);
    expect(row.valid_docs).toBe(1);
    expect(row.expired_docs).toBe(1);
  });
});
