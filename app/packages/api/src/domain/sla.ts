import type { PoolClient } from 'pg';

/**
 * SLA engine (core CAFM). Configurable response/fix tiers by priority, with sensible
 * defaults, plus live SLA status and contractor performance scorecards. See
 * docs/FMIQ-master-build-plan.md §4.2.
 */

export type Priority = 'routine' | 'high' | 'critical';

/** Default fix-time minutes if no tenant policy is configured. */
const DEFAULT_FIX_MINS: Record<Priority, number> = { critical: 120, high: 1440, routine: 4320 };
const DEFAULT_RESPONSE_MINS: Record<Priority, number> = { critical: 15, high: 240, routine: 1440 };

export interface SlaTimes {
  responseMins: number;
  fixMins: number;
  slaDue: string; // ISO due timestamp for the fix
}

/** Resolve the SLA for a priority from the tenant's policy, falling back to defaults. */
export async function resolveSla(client: PoolClient, _tenantId: string, priority: Priority, from: Date = new Date()): Promise<SlaTimes> {
  const { rows } = await client.query<{ response_mins: number; fix_mins: number }>(
    `SELECT response_mins, fix_mins FROM wo_sla_policy WHERE priority = $1 AND active = true LIMIT 1`,
    [priority],
  );
  const responseMins = rows[0]?.response_mins ?? DEFAULT_RESPONSE_MINS[priority];
  const fixMins = rows[0]?.fix_mins ?? DEFAULT_FIX_MINS[priority];
  const slaDue = new Date(from.getTime() + fixMins * 60_000).toISOString();
  return { responseMins, fixMins, slaDue };
}

export type SlaState = 'on_track' | 'at_risk' | 'breached' | 'met';

/** Live SLA state for a work order: met if closed in time; breached if past due; at-risk ≥75%. */
export function slaState(input: { slaDue: string | null; openedAt: string; closedAt: string | null }, now: Date = new Date()): SlaState {
  if (!input.slaDue) return 'on_track';
  const due = new Date(input.slaDue).getTime();
  if (input.closedAt) return new Date(input.closedAt).getTime() <= due ? 'met' : 'breached';
  const nowMs = now.getTime();
  if (nowMs > due) return 'breached';
  const opened = new Date(input.openedAt).getTime();
  const elapsed = (nowMs - opened) / (due - opened);
  return elapsed >= 0.75 ? 'at_risk' : 'on_track';
}

export async function setSlaPolicy(
  client: PoolClient,
  tenantId: string,
  input: { name: string; priority: Priority; responseMins: number; fixMins: number },
): Promise<void> {
  await client.query(
    `INSERT INTO wo_sla_policy (tenant_id, name, priority, response_mins, fix_mins)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (tenant_id, priority) DO UPDATE SET name = $2, response_mins = $4, fix_mins = $5, active = true`,
    [tenantId, input.name, input.priority, input.responseMins, input.fixMins],
  );
}

export interface ContractorScorecard {
  contractorId: string;
  jobs: number;
  closed: number;
  onTimePct: number;
  openBreaches: number;
}

/** Contractor performance: completion + on-time SLA rate + current breaches. */
export async function contractorScorecard(client: PoolClient, _tenantId: string, contractorId: string): Promise<ContractorScorecard> {
  const { rows } = await client.query<{ jobs: number; closed: number; on_time: number; open_breaches: number }>(
    `SELECT
       count(*)::int AS jobs,
       count(*) FILTER (WHERE status = 'closed')::int AS closed,
       count(*) FILTER (WHERE status = 'closed' AND sla_due IS NOT NULL AND closed_at <= sla_due)::int AS on_time,
       count(*) FILTER (WHERE status <> 'closed' AND sla_due IS NOT NULL AND sla_due < now())::int AS open_breaches
     FROM wo_work_order WHERE contractor_id = $1`,
    [contractorId],
  );
  const r = rows[0];
  const onTimePct = r.closed === 0 ? 100 : Math.round((r.on_time / r.closed) * 100);
  return { contractorId, jobs: r.jobs, closed: r.closed, onTimePct, openBreaches: r.open_breaches };
}
