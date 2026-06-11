import type { PoolClient } from 'pg';
import { nextRef } from './workOrders.js';

/**
 * Planned Preventive Maintenance (PPM) scheduling (S5–S6).
 * - propose schedules for an asset from the SFG20-aligned template library,
 * - a compliance clock (green → amber@80% → red@95% → breach) per statutory task,
 * - auto-generation of work orders ahead of the due date (advancing next_due).
 * See docs/FMIQ-master-build-plan.md §4.1.
 */

export type ClockStatus = 'green' | 'amber' | 'red' | 'breach';

/**
 * Compliance clock: how close a due task is, as a fraction of its interval elapsed.
 * breach once overdue; red ≥95% elapsed; amber ≥80%; green otherwise.
 */
export function complianceClock(nextDue: Date, intervalDays: number, now: Date = new Date()): { status: ClockStatus; pctElapsed: number } {
  if (now > nextDue) return { status: 'breach', pctElapsed: 1 };
  const msDay = 86_400_000;
  const daysUntil = (nextDue.getTime() - now.getTime()) / msDay;
  const pctElapsed = intervalDays <= 0 ? 1 : Math.max(0, Math.min(1, (intervalDays - daysUntil) / intervalDays));
  const status: ClockStatus = pctElapsed >= 0.95 ? 'red' : pctElapsed >= 0.8 ? 'amber' : 'green';
  return { status, pctElapsed };
}

export interface ScheduleInput {
  assetId: string;
  taskTemplateId: string;
  frequency?: string | null;
  leadDays?: number;
  nextDue?: string | null;
  triggerType?: 'calendar' | 'meter' | 'seasonal' | 'condition';
}

export interface PpmSchedule {
  id: string;
  asset_id: string;
  task_template_id: string;
  frequency: string | null;
  next_due: string | null;
  classification: string;
  statutory_flag: boolean;
  active: boolean;
}

/** Templates whose discipline/asset_type matches — "adding an asset proposes the schedule". */
export async function proposeTemplates(client: PoolClient, assetType: string | null): Promise<Array<{ id: string; code: string; name: string; default_frequency: string | null }>> {
  const { rows } = await client.query(
    `SELECT id, code, name, default_frequency FROM wo_task_template
      WHERE $1::text IS NULL OR discipline ILIKE '%' || $1 || '%' OR name ILIKE '%' || $1 || '%'
      ORDER BY statutory_flag DESC, code`,
    [assetType],
  );
  return rows;
}

export async function createSchedule(client: PoolClient, tenantId: string, input: ScheduleInput): Promise<PpmSchedule> {
  // Inherit classification/statutory/frequency defaults from the template.
  const { rows } = await client.query<PpmSchedule>(
    `INSERT INTO wo_ppm_schedule (tenant_id, asset_id, task_template_id, trigger_type, frequency, lead_days, next_due, sfg20_ref, classification, statutory_flag)
     SELECT $1, $2, t.id, $4, COALESCE($5, t.default_frequency), $6, $7, t.standard_ref, t.classification, t.statutory_flag
       FROM wo_task_template t WHERE t.id = $3
     RETURNING id, asset_id, task_template_id, frequency, next_due, classification, statutory_flag, active`,
    [tenantId, input.assetId, input.taskTemplateId, input.triggerType ?? 'calendar', input.frequency ?? null, input.leadDays ?? 14, input.nextDue ?? null],
  );
  return rows[0];
}

export interface GeneratedWo {
  workOrderId: string;
  ref: string;
  scheduleId: string;
}

/**
 * Raise work orders for every calendar schedule whose next_due falls within its lead
 * window, then advance next_due by the frequency. Idempotent-ish: a schedule won't
 * generate a second WO until its next_due advances past the window again.
 */
export async function generateDueWorkOrders(client: PoolClient, tenantId: string, now: Date = new Date()): Promise<GeneratedWo[]> {
  const { rows: due } = await client.query<{
    id: string; asset_id: string; space_id: string | null; frequency: string | null; classification: string; task_name: string;
  }>(
    `SELECT s.id, s.asset_id, a.space_id, s.frequency, s.classification, t.name AS task_name
       FROM wo_ppm_schedule s
       JOIN wo_task_template t ON t.id = s.task_template_id
       JOIN est_asset a ON a.id = s.asset_id
      WHERE s.active = true AND s.trigger_type = 'calendar'
        AND s.next_due IS NOT NULL
        AND s.next_due <= ($1::date + (s.lead_days || ' days')::interval)
      FOR UPDATE OF s`,
    [now.toISOString()],
  );

  const generated: GeneratedWo[] = [];
  for (const s of due) {
    const ref = await nextRef(client, tenantId);
    const priority = s.classification === 'red' ? 'high' : 'routine';
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO wo_work_order (tenant_id, ref, space_id, asset_id, source, priority, status, title)
       VALUES ($1,$2,$3,$4,'ppm',$5,'open',$6) RETURNING id`,
      [tenantId, ref, s.space_id, s.asset_id, priority, `${s.task_name} (PPM)`],
    );
    const woId = rows[0].id;
    // Advance the schedule by its frequency (or +1 year if unset) and link the WO.
    await client.query(
      `UPDATE wo_ppm_schedule
          SET last_wo_id = $2,
              next_due = (next_due + COALESCE(NULLIF($3,'')::interval, interval '1 year'))::date
        WHERE id = $1`,
      [s.id, woId, s.frequency ?? ''],
    );
    await client.query(
      `INSERT INTO core_audit_log (tenant_id, entity, entity_id, action, after)
       VALUES ($1,'wo_ppm_schedule',$2,'ppm.wo_generated',$3)`,
      [tenantId, s.id, JSON.stringify({ workOrderId: woId, ref })],
    );
    generated.push({ workOrderId: woId, ref, scheduleId: s.id });
  }
  return generated;
}
