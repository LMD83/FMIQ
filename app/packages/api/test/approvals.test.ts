// EP-7 — gated approvals + budget commitment.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pool } from '../src/db/pool.js';
import { withTenant } from '../src/db/withTenant.js';
import { createTenant } from './helpers/db.js';
import { createRequisition, decide } from '../src/domain/approvals.js';

let tenant: string;
let requester: string;
let fmUser: string;
let taUser: string;
let projectId: string;

beforeAll(async () => {
  tenant = await createTenant('apr');
  await withTenant(tenant, async (c) => {
    requester = (await c.query<{ id: string }>(`INSERT INTO core_user (tenant_id, email, display_name) VALUES ($1,'req@test.local','Req') RETURNING id`, [tenant])).rows[0].id;
    fmUser = (await c.query<{ id: string }>(`INSERT INTO core_user (tenant_id, email, display_name) VALUES ($1,'fm@test.local','FM') RETURNING id`, [tenant])).rows[0].id;
    taUser = (await c.query<{ id: string }>(`INSERT INTO core_user (tenant_id, email, display_name) VALUES ($1,'ta@test.local','TA') RETURNING id`, [tenant])).rows[0].id;
    projectId = (await c.query<{ id: string }>(`INSERT INTO prj_project (tenant_id, name, budget, spend) VALUES ($1,'P',10000,0) RETURNING id`, [tenant])).rows[0].id;
    // Value-band chains: <5k none (auto); 5k–50k one approver; >50k two approvers.
    await c.query(`INSERT INTO apr_chain (tenant_id, name, category, min_amount, max_amount, steps) VALUES
      ($1,'Mid','revenue',5000,50000,'["FacilitiesManager"]'::jsonb),
      ($1,'High','revenue',50000,null,'["FacilitiesManager","TenantAdmin"]'::jsonb)`, [tenant]);
  });
});

afterAll(async () => {
  await pool.end();
});

describe('approvals', () => {
  it('auto-approves + commits a sub-threshold requisition', async () => {
    const r = await withTenant(tenant, (c) => createRequisition(c, tenant, { amountNet: 1200, createdBy: requester }));
    expect(r.status).toBe('committed');
  });

  it('routes an in-band requisition for one approval; segregation of duties blocks the requester', async () => {
    const r = await withTenant(tenant, (c) => createRequisition(c, tenant, { amountNet: 18500, createdBy: requester }));
    expect(r.status).toBe('pending_approval');
    await expect(
      withTenant(tenant, (c) => decide(c, tenant, { requisitionId: r.id, approverId: requester, approverRoles: ['FacilitiesManager'], decision: 'approved' })),
    ).rejects.toMatchObject({ code: 'segregation_of_duties' });
  });

  it('rejects approval from the wrong role', async () => {
    const r = await withTenant(tenant, (c) => createRequisition(c, tenant, { amountNet: 18500, createdBy: requester }));
    await expect(
      withTenant(tenant, (c) => decide(c, tenant, { requisitionId: r.id, approverId: 'other', approverRoles: ['ReadOnly'], decision: 'approved' })),
    ).rejects.toMatchObject({ code: 'wrong_role' });
  });

  it('commits after the single required approval', async () => {
    const r = await withTenant(tenant, (c) => createRequisition(c, tenant, { amountNet: 18500, createdBy: requester }));
    const done = await withTenant(tenant, (c) => decide(c, tenant, { requisitionId: r.id, approverId: fmUser, approverRoles: ['FacilitiesManager'], decision: 'approved' }));
    expect(done.status).toBe('committed');
    const commit = await withTenant(tenant, (c) => c.query<{ n: number }>(`SELECT count(*)::int AS n FROM apr_commitment WHERE requisition_id = $1`, [r.id]));
    expect(commit.rows[0].n).toBe(1);
  });

  it('requires both approvals for a high-value chain; a rejection stops it', async () => {
    const r = await withTenant(tenant, (c) => createRequisition(c, tenant, { amountNet: 80000, createdBy: requester }));
    const afterFirst = await withTenant(tenant, (c) => decide(c, tenant, { requisitionId: r.id, approverId: fmUser, approverRoles: ['FacilitiesManager'], decision: 'approved' }));
    expect(afterFirst.status).toBe('pending_approval');
    expect(afterFirst.current_step).toBe(1);
    const rejected = await withTenant(tenant, (c) => decide(c, tenant, { requisitionId: r.id, approverId: taUser, approverRoles: ['TenantAdmin'], decision: 'rejected' }));
    expect(rejected.status).toBe('rejected');
  });

  it('blocks a commitment that would exceed the project budget', async () => {
    await expect(
      withTenant(tenant, (c) => createRequisition(c, tenant, { amountNet: 12000, projectId, createdBy: requester })),
    ).rejects.toMatchObject({ code: 'over_budget' });
  });
});
