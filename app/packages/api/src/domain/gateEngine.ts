import type { PoolClient } from 'pg';
import { withTenant } from '../db/withTenant.js';
import type { Role } from '../types.js';

/**
 * The gate engine — the platform primitive behind "no paperwork, no work".
 *
 * A *gate* is a named set of checks that an entity (today: a work order) must
 * satisfy before it may progress (e.g. → in_progress). The engine is reusable:
 * the SSoW Readiness Gate and, later, the value-band approval chains both run
 * through `evaluateGates`. Modules declare which checks apply (the GATE_REGISTRY);
 * they never embed gate logic.
 *
 * Split of concerns (mirrors the 002 migration):
 *   • gate *configuration* — mode / on-block / override roles — is DATA in
 *     `gate_definition` (per tenant, overridable). Sensible defaults if absent.
 *   • gate *check implementations* are CODE here, in GATE_REGISTRY.
 *
 * Every evaluation writes a per-check snapshot to `wo_gate_check` and an entry to
 * the append-only `core_audit_log`. Overrides require an allowed role + a reason
 * and are themselves audited. Mirrors the `domain/collectionCare.ts` shape:
 * pure-ish `(client, tenantId, …)` functions run inside a `withTenant` tx.
 */

export type GateMode = 'ALL' | 'ANY';
export type GateBlockMode = 'HARD' | 'SOFT';

export interface GateContext {
  /** Which gate to run, e.g. 'ssow_readiness'. Must exist in GATE_REGISTRY. */
  gateCode: string;
  /** The work order under evaluation. */
  workOrderId: string;
  /** Optional actor (for audit attribution). */
  actorUserId?: string;
}

export interface GateCheckResult {
  checkId: string;
  passed: boolean;
  /** Plain-language reason shown to the user when this check blocks. */
  blockMessage?: string;
  /** Optional machine/diagnostic detail. */
  detail?: string;
}

export interface GateEvaluation {
  gateCode: string;
  mode: GateMode;
  onBlock: GateBlockMode;
  /** Every check passed. */
  allPassed: boolean;
  /** Mode-aware satisfaction (ALL → every check; ANY → at least one). */
  satisfied: boolean;
  /** The entity is blocked from progressing (onBlock HARD and not satisfied). */
  blocked: boolean;
  results: GateCheckResult[];
  blockedBy: GateCheckResult[];
  /** First failing check's blockMessage — what the UI shows on the gate banner. */
  firstBlockMessage?: string;
}

export interface GateOverrideOptions {
  overrideBy: string;
  reason: string;
  actorRoles: Role[];
}

export interface GateOverrideResult {
  overridden: true;
  gateCode: string;
  overriddenChecks: string[];
}

/** Thrown for developer/authorisation errors; `code` is stable for handlers/tests. */
export class GateError extends Error {
  constructor(
    public code: 'unknown_gate' | 'override_forbidden' | 'override_reason_required',
    message: string,
  ) {
    super(message);
    this.name = 'GateError';
  }
}

const DEFAULT_OVERRIDE_ROLES: Role[] = ['SystemAdmin', 'TenantAdmin', 'FacilitiesManager'];

// ---------------------------------------------------------------------------
// Checks — each queries the DB and returns pass/fail. New checks plug in here
// as the SSoW tables land (RAMS approved, permit active, competency valid, parts
// reserved, pre-task done, keys signed out — docs/FMIQ-master-build-plan.md §5.2).
// The ones below query the schema that exists today, so they are real and testable.
// ---------------------------------------------------------------------------

interface GateCheckDef {
  checkId: string;
  blockMessage: string;
  run(client: PoolClient, tenantId: string, ctx: GateContext): Promise<{ passed: boolean; detail?: string }>;
}

interface WorkOrderRow {
  id: string;
  status: string;
  assignee_id: string | null;
  contractor_id: string | null;
  requires_rams: boolean;
  required_permit_type: string | null;
  requires_key: boolean;
}

async function loadWorkOrder(client: PoolClient, workOrderId: string): Promise<WorkOrderRow | null> {
  const { rows } = await client.query<WorkOrderRow>(
    `SELECT id, status, assignee_id, contractor_id, requires_rams, required_permit_type, requires_key
       FROM wo_work_order WHERE id = $1`,
    [workOrderId],
  );
  return rows[0] ?? null;
}

const workOrderExists: GateCheckDef = {
  checkId: 'work_order_exists',
  blockMessage: 'Work order not found.',
  async run(client, _tenantId, ctx) {
    const wo = await loadWorkOrder(client, ctx.workOrderId);
    return { passed: wo !== null };
  },
};

const notClosed: GateCheckDef = {
  checkId: 'not_closed',
  blockMessage: 'Work order is already closed.',
  async run(client, _tenantId, ctx) {
    const wo = await loadWorkOrder(client, ctx.workOrderId);
    if (!wo) return { passed: false, detail: 'work order not found' };
    return { passed: wo.status !== 'closed', detail: `status=${wo.status}` };
  },
};

const assigneePresent: GateCheckDef = {
  checkId: 'assignee_present',
  blockMessage: 'No technician or contractor is assigned.',
  async run(client, _tenantId, ctx) {
    const wo = await loadWorkOrder(client, ctx.workOrderId);
    if (!wo) return { passed: false, detail: 'work order not found' };
    return { passed: wo.assignee_id !== null || wo.contractor_id !== null };
  },
};

const contractorInsuranceValid: GateCheckDef = {
  checkId: 'contractor_insurance_valid',
  blockMessage: 'Assigned contractor has no in-date insurance on record.',
  async run(client, _tenantId, ctx) {
    const wo = await loadWorkOrder(client, ctx.workOrderId);
    if (!wo) return { passed: false, detail: 'work order not found' };
    if (wo.contractor_id === null) return { passed: true, detail: 'in-house (no contractor)' };
    const { rows } = await client.query<{ valid: boolean }>(
      `SELECT (insurance_expiry IS NOT NULL AND insurance_expiry >= current_date) AS valid
         FROM wo_contractor WHERE id = $1`,
      [wo.contractor_id],
    );
    return { passed: rows[0]?.valid === true };
  },
};

// --- SSoW checks (008). Each is conditional on a per-WO requirement flag, so a WO
//     that doesn't need a control isn't blocked by it. "No paperwork, no work." ---

const ramsApproved: GateCheckDef = {
  checkId: 'rams_approved',
  blockMessage: 'No approved, in-date RAMS for this job.',
  async run(client, _tenantId, ctx) {
    const wo = await loadWorkOrder(client, ctx.workOrderId);
    if (!wo) return { passed: false, detail: 'work order not found' };
    if (!wo.requires_rams) return { passed: true, detail: 'RAMS not required' };
    const { rowCount } = await client.query(
      `SELECT 1 FROM hs_rams WHERE work_order_id = $1 AND status = 'approved' AND (valid_to IS NULL OR valid_to >= current_date)`,
      [ctx.workOrderId],
    );
    return { passed: (rowCount ?? 0) > 0 };
  },
};

const permitActive: GateCheckDef = {
  checkId: 'permit_active',
  blockMessage: 'Required permit to work is not issued/active.',
  async run(client, _tenantId, ctx) {
    const wo = await loadWorkOrder(client, ctx.workOrderId);
    if (!wo) return { passed: false, detail: 'work order not found' };
    if (!wo.required_permit_type) return { passed: true, detail: 'no permit required' };
    const { rowCount } = await client.query(
      `SELECT 1 FROM hs_permit
        WHERE work_order_id = $1 AND permit_type = $2 AND status = 'active'
          AND (valid_from IS NULL OR valid_from <= now()) AND (valid_to IS NULL OR valid_to >= now())`,
      [ctx.workOrderId, wo.required_permit_type],
    );
    return { passed: (rowCount ?? 0) > 0 };
  },
};

const competenciesValid: GateCheckDef = {
  checkId: 'competencies_valid',
  blockMessage: 'Assigned contractor has an expired competency/cert.',
  async run(client, _tenantId, ctx) {
    const wo = await loadWorkOrder(client, ctx.workOrderId);
    if (!wo) return { passed: false, detail: 'work order not found' };
    if (wo.contractor_id === null) return { passed: true, detail: 'in-house' };
    const { rowCount } = await client.query(
      `SELECT 1 FROM hs_competency WHERE contractor_id = $1 AND expiry IS NOT NULL AND expiry < current_date`,
      [wo.contractor_id],
    );
    return { passed: (rowCount ?? 0) === 0 }; // any expired competency blocks
  },
};

const pretaskComplete: GateCheckDef = {
  checkId: 'pretask_complete',
  blockMessage: 'Daily pre-task ("Take 5") not completed, or a new hazard is unresolved.',
  async run(client, _tenantId, ctx) {
    const wo = await loadWorkOrder(client, ctx.workOrderId);
    if (!wo) return { passed: false, detail: 'work order not found' };
    if (!wo.requires_rams) return { passed: true, detail: 'pre-task not required' };
    const { rowCount } = await client.query(
      `SELECT 1 FROM hs_pretask WHERE work_order_id = $1 AND completed_at::date = current_date AND new_hazard = false`,
      [ctx.workOrderId],
    );
    return { passed: (rowCount ?? 0) > 0 };
  },
};

const keysSignedOut: GateCheckDef = {
  checkId: 'keys_signed_out',
  blockMessage: 'Required keys/access not signed out.',
  async run(client, _tenantId, ctx) {
    const wo = await loadWorkOrder(client, ctx.workOrderId);
    if (!wo) return { passed: false, detail: 'work order not found' };
    if (!wo.requires_key) return { passed: true, detail: 'no key required' };
    const { rowCount } = await client.query(
      `SELECT 1 FROM hs_keyloan WHERE work_order_id = $1 AND returned_at IS NULL`,
      [ctx.workOrderId],
    );
    return { passed: (rowCount ?? 0) > 0 };
  },
};

const taxClearanceValid: GateCheckDef = {
  checkId: 'tax_clearance_valid',
  blockMessage: 'Assigned contractor is not tax-compliant (Revenue eTax Clearance).',
  async run(client, _tenantId, ctx) {
    const wo = await loadWorkOrder(client, ctx.workOrderId);
    if (!wo) return { passed: false, detail: 'work order not found' };
    if (wo.contractor_id === null) return { passed: true, detail: 'in-house' };
    const { rows } = await client.query<{ tax_clearance_status: string | null }>(
      `SELECT tax_clearance_status FROM wo_contractor WHERE id = $1`,
      [wo.contractor_id],
    );
    const status = rows[0]?.tax_clearance_status;
    // Block only on an explicit non-compliant result; null/'unknown'/'valid' pass
    // (the daily re-check populates status — see domain/taxClearance.ts).
    const blocked = status === 'expired' || status === 'revoked' || status === 'suspended';
    return { passed: !blocked, detail: status ?? 'unknown' };
  },
};

/** Task type / gate code → the checks that apply. The single place modules declare gates. */
export const GATE_REGISTRY: Record<string, GateCheckDef[]> = {
  ssow_readiness: [
    workOrderExists,
    notClosed,
    assigneePresent,
    contractorInsuranceValid,
    competenciesValid,
    taxClearanceValid,
    ramsApproved,
    permitActive,
    pretaskComplete,
    keysSignedOut,
  ],
};

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

interface GateConfig {
  definitionId: string | null;
  mode: GateMode;
  onBlock: GateBlockMode;
  overrideRoles: Role[];
}

async function loadGateConfig(client: PoolClient, gateCode: string): Promise<GateConfig> {
  const { rows } = await client.query<{
    id: string;
    mode: GateMode;
    on_block: GateBlockMode;
    override_roles: Role[];
  }>(
    `SELECT id, mode, on_block, override_roles
       FROM gate_definition WHERE code = $1 AND active = true LIMIT 1`,
    [gateCode],
  );
  const row = rows[0];
  if (!row) {
    return { definitionId: null, mode: 'ALL', onBlock: 'HARD', overrideRoles: DEFAULT_OVERRIDE_ROLES };
  }
  return {
    definitionId: row.id,
    mode: row.mode,
    onBlock: row.on_block,
    overrideRoles: row.override_roles.length > 0 ? row.override_roles : DEFAULT_OVERRIDE_ROLES,
  };
}

async function writeAudit(
  client: PoolClient,
  tenantId: string,
  action: string,
  entityId: string,
  userId: string | null,
  after: unknown,
): Promise<void> {
  await client.query(
    `INSERT INTO core_audit_log (tenant_id, user_id, entity, entity_id, action, after)
     VALUES ($1,$2,'wo_work_order',$3,$4,$5)`,
    [tenantId, userId, entityId, action, JSON.stringify(after)],
  );
}

/**
 * Evaluate a gate for a work order. Runs every applicable check, records a
 * per-check snapshot in `wo_gate_check`, audits the evaluation, and returns the
 * mode-aware verdict. Does not mutate the work order — the caller decides whether
 * to allow the transition based on `blocked`.
 */
export async function evaluateGates(
  client: PoolClient,
  tenantId: string,
  ctx: GateContext,
  opts: { persist?: boolean } = {},
): Promise<GateEvaluation> {
  const persist = opts.persist ?? true;
  const checks = GATE_REGISTRY[ctx.gateCode];
  if (!checks) throw new GateError('unknown_gate', `No gate registered for code '${ctx.gateCode}'`);

  const config = await loadGateConfig(client, ctx.gateCode);

  const results: GateCheckResult[] = [];
  for (const check of checks) {
    const { passed, detail } = await check.run(client, tenantId, ctx);
    results.push({
      checkId: check.checkId,
      passed,
      detail,
      blockMessage: passed ? undefined : check.blockMessage,
    });
  }

  const allPassed = results.every((r) => r.passed);
  const satisfied = config.mode === 'ANY' ? results.some((r) => r.passed) : allPassed;
  const blocked = config.onBlock === 'HARD' && !satisfied;
  const blockedBy = results.filter((r) => !r.passed);

  // Snapshot each check — but only if the work order row exists (FK on wo_gate_check).
  // `persist: false` makes evaluation a side-effect-free preview (used by GET endpoints).
  const woExists = results.find((r) => r.checkId === 'work_order_exists')?.passed ?? true;
  if (persist && woExists) {
    for (const r of results) {
      await client.query(
        `INSERT INTO wo_gate_check
           (tenant_id, work_order_id, gate_definition_id, gate_code, check_id, status, blocking_detail)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          tenantId,
          ctx.workOrderId,
          config.definitionId,
          ctx.gateCode,
          r.checkId,
          r.passed ? 'pass' : 'fail',
          r.passed ? null : r.detail ?? r.blockMessage ?? null,
        ],
      );
    }
  }

  if (persist) {
    await writeAudit(client, tenantId, blocked ? 'gate.blocked' : 'gate.evaluated', ctx.workOrderId, ctx.actorUserId ?? null, {
      gateCode: ctx.gateCode,
      mode: config.mode,
      onBlock: config.onBlock,
      satisfied,
      blockedBy: blockedBy.map((r) => r.checkId),
    });
  }

  return {
    gateCode: ctx.gateCode,
    mode: config.mode,
    onBlock: config.onBlock,
    allPassed,
    satisfied,
    blocked,
    results,
    blockedBy,
    firstBlockMessage: blockedBy[0]?.blockMessage,
  };
}

/**
 * Record a documented override of the currently-failing checks for a gate.
 * Requires an allowed role (gate_definition.override_roles, or the platform
 * default) and a non-empty reason. Writes 'override' snapshots + an audit entry.
 */
export async function overrideGate(
  client: PoolClient,
  tenantId: string,
  ctx: GateContext,
  opts: GateOverrideOptions,
): Promise<GateOverrideResult> {
  if (!GATE_REGISTRY[ctx.gateCode]) {
    throw new GateError('unknown_gate', `No gate registered for code '${ctx.gateCode}'`);
  }
  const config = await loadGateConfig(client, ctx.gateCode);

  const allowed = opts.actorRoles.some((r) => config.overrideRoles.includes(r));
  if (!allowed) {
    throw new GateError('override_forbidden', `Role(s) [${opts.actorRoles.join(', ')}] may not override '${ctx.gateCode}'`);
  }
  if (!opts.reason || opts.reason.trim() === '') {
    throw new GateError('override_reason_required', 'A documented reason is required to override a gate.');
  }

  // Re-evaluate to learn which checks are currently failing.
  const evaluation = await evaluateGates(client, tenantId, ctx);
  const overriddenChecks = evaluation.blockedBy.map((r) => r.checkId);
  const woExists = evaluation.results.find((r) => r.checkId === 'work_order_exists')?.passed ?? true;

  if (woExists) {
    for (const r of evaluation.blockedBy) {
      await client.query(
        `INSERT INTO wo_gate_check
           (tenant_id, work_order_id, gate_definition_id, gate_code, check_id, status, blocking_detail, override_by, override_reason)
         VALUES ($1,$2,$3,$4,$5,'override',$6,$7,$8)`,
        [
          tenantId,
          ctx.workOrderId,
          config.definitionId,
          ctx.gateCode,
          r.checkId,
          r.detail ?? r.blockMessage ?? null,
          opts.overrideBy,
          opts.reason.trim(),
        ],
      );
    }
  }

  await writeAudit(client, tenantId, 'gate.overridden', ctx.workOrderId, opts.overrideBy, {
    gateCode: ctx.gateCode,
    overriddenChecks,
    reason: opts.reason.trim(),
  });

  return { overridden: true, gateCode: ctx.gateCode, overriddenChecks };
}

/** Convenience wrapper: evaluate a gate in its own tenant-scoped transaction. */
export function evaluateWorkOrderGate(tenantId: string, ctx: GateContext): Promise<GateEvaluation> {
  return withTenant(tenantId, (client) => evaluateGates(client, tenantId, ctx));
}
