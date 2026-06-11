import type { PoolClient } from 'pg';
import { evaluateGates, type GateEvaluation } from './gateEngine.js';

/**
 * Work-order domain logic: the human-friendly reference scheme and the gate-enforced
 * state machine ("no paperwork, no work"). Thin routes call these; mirrors the
 * `(client, tenantId, …)` shape of collectionCare/gateEngine.
 */

export type WorkOrderStatus = 'open' | 'assigned' | 'in_progress' | 'closed';

/** Allowed forward transitions. (Re-opening is deliberately not modelled yet.) */
const TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  open: ['assigned', 'closed'],
  assigned: ['in_progress', 'closed'],
  in_progress: ['closed'],
  closed: [],
};

/** Transitions that must clear the SSoW Readiness Gate before they are allowed. */
const GATED_TRANSITIONS: Partial<Record<WorkOrderStatus, string>> = {
  in_progress: 'ssow_readiness',
};

export class WorkOrderError extends Error {
  constructor(
    public code: 'not_found' | 'invalid_transition' | 'missing_fields',
    message: string,
  ) {
    super(message);
    this.name = 'WorkOrderError';
  }
}

/** Raised when a gated transition is blocked. The route maps this to HTTP 409. */
export class GateBlockedError extends Error {
  constructor(
    public gateCode: string,
    public evaluation: GateEvaluation,
  ) {
    super(evaluation.firstBlockMessage ?? `Blocked by gate '${gateCode}'`);
    this.name = 'GateBlockedError';
  }
}

/**
 * Atomically allocate the next per-tenant reference for a scope, e.g. WO-2026-00042.
 * Uses an UPSERT on `core_counter` so concurrent callers each get a distinct value.
 */
export async function nextRef(client: PoolClient, tenantId: string, scope = 'work_order', prefix = 'WO'): Promise<string> {
  const { rows } = await client.query<{ value: string }>(
    `INSERT INTO core_counter (tenant_id, scope, value) VALUES ($1, $2, 1)
     ON CONFLICT (tenant_id, scope) DO UPDATE SET value = core_counter.value + 1
     RETURNING value`,
    [tenantId, scope],
  );
  const value = Number(rows[0].value);
  return `${prefix}-${new Date().getUTCFullYear()}-${String(value).padStart(5, '0')}`;
}

/** Check ids on this work order's gate that have a recorded override. */
async function overriddenCheckIds(client: PoolClient, workOrderId: string, gateCode: string): Promise<Set<string>> {
  const { rows } = await client.query<{ check_id: string }>(
    `SELECT DISTINCT check_id FROM wo_gate_check WHERE work_order_id = $1 AND gate_code = $2 AND status = 'override'`,
    [workOrderId, gateCode],
  );
  return new Set(rows.map((r) => r.check_id));
}

async function writeAudit(
  client: PoolClient,
  tenantId: string,
  action: string,
  entityId: string,
  userId: string | null,
  before: unknown,
  after: unknown,
): Promise<void> {
  await client.query(
    `INSERT INTO core_audit_log (tenant_id, user_id, entity, entity_id, action, before, after)
     VALUES ($1,$2,'wo_work_order',$3,$4,$5,$6)`,
    [tenantId, userId, entityId, action, JSON.stringify(before), JSON.stringify(after)],
  );
}

export interface TransitionInput {
  workOrderId: string;
  toStatus: WorkOrderStatus;
  actorUserId?: string;
}

export interface TransitionResult {
  workOrderId: string;
  from: WorkOrderStatus;
  to: WorkOrderStatus;
  gate?: GateEvaluation;
}

/**
 * Move a work order to `toStatus`. Validates the transition, runs any required gate
 * (HARD-blocking → GateBlockedError), updates status (+ closed_at on close), and audits.
 */
export async function transitionWorkOrder(
  client: PoolClient,
  tenantId: string,
  input: TransitionInput,
): Promise<TransitionResult> {
  const { rows } = await client.query<{ status: WorkOrderStatus }>(
    `SELECT status FROM wo_work_order WHERE id = $1`,
    [input.workOrderId],
  );
  const current = rows[0];
  if (!current) throw new WorkOrderError('not_found', 'Work order not found.');

  const from = current.status;
  const to = input.toStatus;
  if (from === to) {
    return { workOrderId: input.workOrderId, from, to };
  }
  if (!TRANSITIONS[from].includes(to)) {
    throw new WorkOrderError('invalid_transition', `Cannot move work order from '${from}' to '${to}'.`);
  }

  let gate: GateEvaluation | undefined;
  const gateCode = GATED_TRANSITIONS[to];
  if (gateCode) {
    gate = await evaluateGates(client, tenantId, { gateCode, workOrderId: input.workOrderId, actorUserId: input.actorUserId });
    if (gate.blocked) {
      // A documented override (recorded via overrideGate) clears the checks it covers.
      const overridden = await overriddenCheckIds(client, input.workOrderId, gateCode);
      const stillBlocking = gate.blockedBy.filter((c) => !overridden.has(c.checkId));
      if (stillBlocking.length > 0) throw new GateBlockedError(gateCode, gate);
    }
  }

  await client.query(
    `UPDATE wo_work_order
        SET status = $2,
            closed_at = CASE WHEN $2 = 'closed' THEN now() ELSE closed_at END
      WHERE id = $1`,
    [input.workOrderId, to],
  );
  await writeAudit(client, tenantId, 'work_order.status_changed', input.workOrderId, input.actorUserId ?? null, { status: from }, { status: to });

  return { workOrderId: input.workOrderId, from, to, gate };
}

export interface CloseInput {
  workOrderId: string;
  failureMode: string;
  failureCause?: string | null;
  failureRemedy?: string | null;
  actorUserId?: string;
}

/**
 * Close a work order with mandatory failure coding (FMEA-style). The failure mode is
 * required — a job cannot be closed "blind". Records the codes, then transitions to closed.
 */
export async function closeWorkOrder(client: PoolClient, tenantId: string, input: CloseInput): Promise<TransitionResult> {
  if (!input.failureMode || input.failureMode.trim() === '') {
    throw new WorkOrderError('missing_fields', 'A failure mode is required to close a work order.');
  }
  await client.query(
    `UPDATE wo_work_order SET failure_mode = $2, failure_cause = $3, failure_remedy = $4, confirmed_by = $5, confirmed_at = now() WHERE id = $1`,
    [input.workOrderId, input.failureMode.trim(), input.failureCause ?? null, input.failureRemedy ?? null, input.actorUserId ?? null],
  );
  return transitionWorkOrder(client, tenantId, { workOrderId: input.workOrderId, toStatus: 'closed', actorUserId: input.actorUserId });
}
