// ERP procurement boundary — Agresso/SAP adapters + issue-PO + callback.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pool } from '../src/db/pool.js';
import { withTenant } from '../src/db/withTenant.js';
import { createTenant } from './helpers/db.js';
import { createRequisition, issuePurchaseOrder, recordPoCallback } from '../src/domain/approvals.js';
import { agressoProcurementGateway } from '../src/adapters/erp/agresso.js';
import { sapProcurementGateway } from '../src/adapters/erp/sap.js';

let tenant: string;
let requester: string;

beforeAll(async () => {
  tenant = await createTenant('erp');
  await withTenant(tenant, async (c) => {
    requester = (await c.query<{ id: string }>(`INSERT INTO core_user (tenant_id, email, display_name) VALUES ($1,'r@test.local','R') RETURNING id`, [tenant])).rows[0].id;
  });
});

afterAll(async () => {
  await pool.end();
});

describe('ERP adapters', () => {
  it('Agresso gateway maps the requisition to a PO reference', async () => {
    const gw = agressoProcurementGateway(async (p) => ({ poReference: `AGR-${p.requisitionId.slice(0, 4)}` }));
    const po = await gw.issuePurchaseOrder({ requisitionId: 'abcd-1234', amountNet: 100 });
    expect(po?.poReference).toBe('AGR-abcd');
  });

  it('SAP gateway maps poNumber → poReference', async () => {
    const gw = sapProcurementGateway(async () => ({ poNumber: 'SAP-999' }));
    const po = await gw.issuePurchaseOrder({ requisitionId: 'x', amountNet: 100 });
    expect(po?.poReference).toBe('SAP-999');
  });
});

describe('issue PO + callback', () => {
  it('issues a PO for a committed requisition via a stub gateway', async () => {
    const req = await withTenant(tenant, (c) => createRequisition(c, tenant, { amountNet: 800, createdBy: requester })); // sub-threshold → committed
    expect(req.status).toBe('committed');
    const gw = agressoProcurementGateway(async () => ({ poReference: 'AGR-1' }));
    const po = await withTenant(tenant, (c) => issuePurchaseOrder(c, tenant, req.id, gw));
    expect(po?.poReference).toBe('AGR-1');
    const row = await withTenant(tenant, (c) => c.query<{ po_reference: string | null }>(`SELECT po_reference FROM apr_requisition WHERE id = $1`, [req.id]));
    expect(row.rows[0].po_reference).toBe('AGR-1');
  });

  it('refuses to issue a PO before commitment', async () => {
    // 18.5k with no chain in this tenant → status 'approved' then auto-commit? No chain → auto-committed.
    // Force a non-committed state by inserting a pending requisition directly.
    const id = await withTenant(tenant, async (c) =>
      (await c.query<{ id: string }>(`INSERT INTO apr_requisition (tenant_id, amount_net, status) VALUES ($1, 5000, 'pending_approval') RETURNING id`, [tenant])).rows[0].id,
    );
    await expect(withTenant(tenant, (c) => issuePurchaseOrder(c, tenant, id))).rejects.toMatchObject({ code: 'not_committed' });
  });

  it('records an ERP po-callback (PO/GRN/payment)', async () => {
    const req = await withTenant(tenant, (c) => createRequisition(c, tenant, { amountNet: 500, createdBy: requester }));
    const ok = await withTenant(tenant, (c) => recordPoCallback(c, tenant, { requisitionId: req.id, poReference: 'PO-7', grnNumber: 'GRN-7', paymentStatus: 'paid' }));
    expect(ok).toBe(true);
    const row = await withTenant(tenant, (c) => c.query<{ grn_number: string; payment_status: string }>(`SELECT grn_number, payment_status FROM apr_requisition WHERE id = $1`, [req.id]));
    expect(row.rows[0]).toMatchObject({ grn_number: 'GRN-7', payment_status: 'paid' });
  });
});
