import type { PoolClient } from 'pg';
import { nextRef } from './workOrders.js';
import { recordInspection } from './compliance.js';
import type { FirePanelEvent } from '../adapters/firePanel.js';
import type { EmergencyLightingTest } from '../adapters/emergencyLighting.js';

/**
 * Life-safety panel ingest (S8/EP-INT). Turns fire-alarm and emergency-lighting events
 * into FMIQ records automatically — replacing the manual transcription that is the
 * leading cause of statutory record gaps (I.S. 3218 / I.S. 3217).
 */

export interface FirePanelIngestResult {
  eventType: string;
  workOrderId?: string;
}

/** A fault auto-raises a reactive WO; activations/tests are audited (and could suspend WOs). */
export async function ingestFirePanelEvent(
  client: PoolClient,
  tenantId: string,
  event: FirePanelEvent,
  spaceId?: string | null,
): Promise<FirePanelIngestResult> {
  await client.query(
    `INSERT INTO core_audit_log (tenant_id, entity, action, after)
     VALUES ($1,'cmp_certificate','fire_panel.event',$2)`,
    [tenantId, JSON.stringify(event)],
  );
  if (event.eventType === 'fault') {
    const ref = await nextRef(client, tenantId);
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO wo_work_order (tenant_id, ref, space_id, source, priority, status, title, conservation_notes)
       VALUES ($1,$2,$3,'reactive','high','open',$4,$5) RETURNING id`,
      [tenantId, ref, spaceId ?? null, `Fire panel fault — ${event.zone ?? event.externalId}`, event.detail ?? null],
    );
    return { eventType: event.eventType, workOrderId: rows[0].id };
  }
  return { eventType: event.eventType };
}

/** Emergency-lighting self-test → a compliance inspection (a failed luminaire → remedial WO). */
export async function ingestEmergencyLightingTest(
  client: PoolClient,
  tenantId: string,
  test: EmergencyLightingTest,
  spaceId?: string | null,
) {
  return recordInspection(client, tenantId, {
    spaceId: spaceId ?? null,
    items: test.luminaires.map((l) => ({ label: `Luminaire ${l.ref}`, pass: l.pass, note: l.note ?? null })),
  });
}
