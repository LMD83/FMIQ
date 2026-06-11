import type { PoolClient } from 'pg';

/**
 * Gated approvals + budget-commitment tracking (EP-7). Multi-step, role-separated
 * authorisation by spend band; on full approval a budget commitment is reserved.
 * FMIQ stops at an approved + committed requisition — the integration boundary where
 * an ERP would later issue a PO (the ProcurementGateway port, stubbed here).
 * See docs/FMIQ-master-build-plan.md §6.
 */

export interface ProcurementGateway {
  issuePurchaseOrder(req: { requisitionId: string; amountNet: number }): Promise<{ poReference: string } | null>;
}

/** Deferred integration: returns null (no PO yet). Swap for an Agresso/SAP adapter in P2. */
export const nullProcurementGateway: ProcurementGateway = {
  async issuePurchaseOrder() {
    return null;
  },
};

export class ApprovalError extends Error {
  constructor(
    public code: 'not_found' | 'segregation_of_duties' | 'wrong_role' | 'not_pending' | 'over_budget' | 'not_committed',
    message: string,
  ) {
    super(message);
    this.name = 'ApprovalError';
  }
}

export interface RequisitionInput {
  amountNet: number;
  category?: 'capital' | 'revenue' | 'emergency';
  costCentre?: string | null;
  projectId?: string | null;
  workOrderId?: string | null;
  supplierId?: string | null;
  createdBy: string;
}

export interface Requisition {
  id: string;
  status: string;
  current_step: number;
  amount_net: number;
}

async function audit(client: PoolClient, tenantId: string, action: string, entityId: string, userId: string | null, after: unknown): Promise<void> {
  await client.query(
    `INSERT INTO core_audit_log (tenant_id, user_id, entity, entity_id, action, after) VALUES ($1,$2,'apr_requisition',$3,$4,$5)`,
    [tenantId, userId, entityId, action, JSON.stringify(after)],
  );
}

async function commit(client: PoolClient, tenantId: string, req: { id: string; amount_net: number; cost_centre: string | null; project_id?: string | null }): Promise<void> {
  await client.query(
    `INSERT INTO apr_commitment (tenant_id, requisition_id, cost_centre, project_id, amount_net) VALUES ($1,$2,$3,$4,$5)`,
    [tenantId, req.id, req.cost_centre, (req as { project_id?: string | null }).project_id ?? null, req.amount_net],
  );
  await client.query(`UPDATE apr_requisition SET status = 'committed' WHERE id = $1`, [req.id]);
}

/**
 * Create a requisition and route it through the matching value-band chain.
 * If no chain matches (e.g. below the lowest threshold), it is auto-approved + committed.
 * If a project is set, the new commitment must not push committed spend over budget.
 */
export async function createRequisition(client: PoolClient, tenantId: string, input: RequisitionInput): Promise<Requisition> {
  const category = input.category ?? 'revenue';

  // Budget guard (committed-vs-budget) for project-funded requisitions.
  if (input.projectId) {
    const { rows } = await client.query<{ budget: number | null; committed: number | null }>(
      `SELECT p.budget,
              (SELECT COALESCE(sum(amount_net),0) FROM apr_commitment c WHERE c.project_id = p.id AND c.status = 'committed') AS committed
         FROM prj_project p WHERE p.id = $1`,
      [input.projectId],
    );
    const p = rows[0];
    if (p?.budget != null && Number(p.committed) + input.amountNet > Number(p.budget)) {
      throw new ApprovalError('over_budget', 'Commitment would exceed the project budget.');
    }
  }

  const { rows: chains } = await client.query<{ id: string; steps: string[] }>(
    `SELECT id, steps FROM apr_chain
      WHERE active = true AND category = $1 AND min_amount <= $2 AND (max_amount IS NULL OR max_amount >= $2)
      ORDER BY min_amount DESC LIMIT 1`,
    [category, input.amountNet],
  );
  const chain = chains[0];

  const { rows } = await client.query<Requisition>(
    `INSERT INTO apr_requisition (tenant_id, chain_id, work_order_id, project_id, cost_centre, supplier_id, amount_net, category, status, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING id, status, current_step, amount_net`,
    [tenantId, chain?.id ?? null, input.workOrderId ?? null, input.projectId ?? null, input.costCentre ?? null, input.supplierId ?? null, input.amountNet, category,
     chain ? 'pending_approval' : 'approved', input.createdBy],
  );
  const req = rows[0];

  if (!chain || chain.steps.length === 0) {
    // No approval needed → commit immediately.
    await commit(client, tenantId, { id: req.id, amount_net: input.amountNet, cost_centre: input.costCentre ?? null, project_id: input.projectId ?? null });
    await audit(client, tenantId, 'requisition.auto_approved', req.id, input.createdBy, { amountNet: input.amountNet });
    return { ...req, status: 'committed' };
  }

  for (let i = 0; i < chain.steps.length; i++) {
    await client.query(
      `INSERT INTO apr_step (tenant_id, requisition_id, step_order, approver_role) VALUES ($1,$2,$3,$4)`,
      [tenantId, req.id, i, chain.steps[i]],
    );
  }
  await audit(client, tenantId, 'requisition.created', req.id, input.createdBy, { amountNet: input.amountNet, steps: chain.steps.length });
  return req;
}

export interface DecisionInput {
  requisitionId: string;
  approverId: string;
  approverRoles: string[];
  decision: 'approved' | 'rejected';
  comment?: string | null;
}

/**
 * Record a decision on the requisition's current step. Enforces segregation of duties
 * (the creator may not approve) and role match. On the final approval, commits budget.
 */
export async function decide(client: PoolClient, tenantId: string, input: DecisionInput): Promise<Requisition> {
  const { rows } = await client.query<Requisition & { created_by: string | null; cost_centre: string | null; project_id: string | null; chain_id: string | null }>(
    `SELECT id, status, current_step, amount_net, created_by, cost_centre, project_id, chain_id FROM apr_requisition WHERE id = $1`,
    [input.requisitionId],
  );
  const req = rows[0];
  if (!req) throw new ApprovalError('not_found', 'Requisition not found.');
  if (req.status !== 'pending_approval') throw new ApprovalError('not_pending', `Requisition is ${req.status}.`);
  if (req.created_by && req.created_by === input.approverId) {
    throw new ApprovalError('segregation_of_duties', 'The requester cannot approve their own requisition.');
  }

  const { rows: steps } = await client.query<{ id: string; approver_role: string }>(
    `SELECT id, approver_role FROM apr_step WHERE requisition_id = $1 AND step_order = $2`,
    [input.requisitionId, req.current_step],
  );
  const step = steps[0];
  if (!step) throw new ApprovalError('not_found', 'No pending step.');
  if (!input.approverRoles.includes(step.approver_role)) {
    throw new ApprovalError('wrong_role', `This step requires role '${step.approver_role}'.`);
  }

  await client.query(
    `UPDATE apr_step SET decision = $2, approver_id = $3, decided_at = now(), comment = $4 WHERE id = $1`,
    [step.id, input.decision, input.approverId, input.comment ?? null],
  );

  if (input.decision === 'rejected') {
    await client.query(`UPDATE apr_requisition SET status = 'rejected' WHERE id = $1`, [req.id]);
    await audit(client, tenantId, 'requisition.rejected', req.id, input.approverId, { step: req.current_step });
    return { ...req, status: 'rejected' };
  }

  const { rows: countRows } = await client.query<{ n: number }>(`SELECT count(*)::int AS n FROM apr_step WHERE requisition_id = $1`, [req.id]);
  const isLast = req.current_step + 1 >= countRows[0].n;
  if (isLast) {
    await commit(client, tenantId, { id: req.id, amount_net: Number(req.amount_net), cost_centre: req.cost_centre, project_id: req.project_id });
    await audit(client, tenantId, 'requisition.committed', req.id, input.approverId, { amountNet: Number(req.amount_net) });
    return { ...req, status: 'committed' };
  }

  await client.query(`UPDATE apr_requisition SET current_step = current_step + 1 WHERE id = $1`, [req.id]);
  await audit(client, tenantId, 'requisition.step_approved', req.id, input.approverId, { step: req.current_step });
  return { ...req, status: 'pending_approval', current_step: req.current_step + 1 };
}

// --- ERP procurement boundary (deferred PO issuance) ---------------------------

export interface PoResult { poReference: string }

/**
 * Issue a PO for a committed requisition via the ProcurementGateway (Agresso/SAP adapter,
 * or the null stub). FMIQ stops at this boundary; the ERP owns PO + invoice + 3-way match.
 */
export async function issuePurchaseOrder(
  client: PoolClient,
  tenantId: string,
  requisitionId: string,
  gateway: ProcurementGateway = nullProcurementGateway,
): Promise<PoResult | null> {
  const { rows } = await client.query<{ id: string; amount_net: number; status: string }>(
    `SELECT id, amount_net, status FROM apr_requisition WHERE id = $1`,
    [requisitionId],
  );
  const req = rows[0];
  if (!req) throw new ApprovalError('not_found', 'Requisition not found.');
  if (req.status !== 'committed') throw new ApprovalError('not_committed', `Requisition must be committed before a PO is issued (is ${req.status}).`);

  const po = await gateway.issuePurchaseOrder({ requisitionId, amountNet: Number(req.amount_net) });
  if (po) {
    await client.query(`UPDATE apr_requisition SET po_reference = $2, po_issued_at = now() WHERE id = $1`, [requisitionId, po.poReference]);
  }
  await audit(client, tenantId, 'requisition.po_issued', requisitionId, null, { poReference: po?.poReference ?? null });
  return po;
}

/** Inbound ERP callback: record PO/GRN/payment status (FMIQ never stores invoice data). */
export async function recordPoCallback(
  client: PoolClient,
  tenantId: string,
  input: { requisitionId: string; poReference?: string | null; grnNumber?: string | null; paymentStatus?: string | null },
): Promise<boolean> {
  const { rowCount } = await client.query(
    `UPDATE apr_requisition SET po_reference = COALESCE($2, po_reference), grn_number = $3, payment_status = $4 WHERE id = $1`,
    [input.requisitionId, input.poReference ?? null, input.grnNumber ?? null, input.paymentStatus ?? null],
  );
  await audit(client, tenantId, 'requisition.erp_callback', input.requisitionId, null, {
    poReference: input.poReference ?? null, grnNumber: input.grnNumber ?? null, paymentStatus: input.paymentStatus ?? null,
  });
  return (rowCount ?? 0) > 0;
}
