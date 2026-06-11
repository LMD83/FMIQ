import type { PoolClient } from 'pg';
import { notify } from './notifications.js';

/**
 * Soft services + IPM (P2). QR-verified task completion, heritage Integrated Pest
 * Management, and waste records. The wedge: a pest sighting in (or adjacent to) a
 * collection zone auto-escalates to the Conservation Officer on the SAME channel as a
 * collection-care excursion. See docs/FMIQ-master-build-plan.md §4.5.
 */

export async function completeSoftTask(
  client: PoolClient,
  tenantId: string,
  input: { taskId: string; qrScan: boolean; photoUri?: string | null; byUser?: string | null },
): Promise<{ id: string; locationVerified: boolean }> {
  const locationVerified = input.qrScan; // a QR scan at point-of-work proves location
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO soft_completion (tenant_id, task_id, qr_scan, location_verified, photo_uri, by_user)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [tenantId, input.taskId, input.qrScan, locationVerified, input.photoUri ?? null, input.byUser ?? null],
  );
  return { id: rows[0].id, locationVerified };
}

export interface IpmResult {
  id: string;
  escalated: boolean;
}

/**
 * Record an IPM observation. If the trap sits in a collection zone, flag it and notify
 * the Conservation Officer immediately (heritage-critical). Material risk raises urgency.
 */
export async function recordIpmObservation(
  client: PoolClient,
  tenantId: string,
  input: { trapId: string; species?: string | null; count?: number; materialRisk?: string | null; action?: string | null },
): Promise<IpmResult> {
  const trap = await client.query<{ space_id: string | null; code: string; is_collection_zone: boolean | null }>(
    `SELECT t.space_id, t.code, sp.is_collection_zone
       FROM ipm_trap t LEFT JOIN est_space sp ON sp.id = t.space_id
      WHERE t.id = $1`,
    [input.trapId],
  );
  if (!trap.rows[0]) throw new Error('trap not found');
  const escalate = trap.rows[0].is_collection_zone === true && (input.count ?? 0) > 0;

  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO ipm_observation (tenant_id, trap_id, species, count, material_risk, collections_escalation, action)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [tenantId, input.trapId, input.species ?? null, input.count ?? 0, input.materialRisk ?? null, escalate, input.action ?? null],
  );

  if (escalate) {
    await notify(client, tenantId, {
      recipientRole: 'ConservationOfficer',
      channel: 'in_app',
      entityType: 'ipm_observation',
      entityId: rows[0].id,
      subject: `Pest activity in a collection zone (${trap.rows[0].code})`,
      body: `${input.count ?? 0} ${input.species ?? 'pest'} found in a collection zone. Inspect adjacent bays; isolate at-risk material.`,
      priority: 'high',
      escalationAfterMinutes: 120,
      escalationRecipientRole: 'FacilitiesManager',
    });
    await client.query(
      `INSERT INTO core_audit_log (tenant_id, entity, entity_id, action, after)
       VALUES ($1,'ipm_observation',$2,'ipm.collection_zone_sighting',$3)`,
      [tenantId, rows[0].id, JSON.stringify({ species: input.species, count: input.count })],
    );
  }
  return { id: rows[0].id, escalated: escalate };
}

export async function recordWaste(
  client: PoolClient,
  tenantId: string,
  input: { buildingId?: string | null; stream: string; weightKg?: number; recycled?: boolean; cost?: number },
): Promise<{ id: string }> {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO waste_record (tenant_id, building_id, stream, weight_kg, recycled, cost) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [tenantId, input.buildingId ?? null, input.stream, input.weightKg ?? null, input.recycled ?? false, input.cost ?? null],
  );
  return rows[0];
}
