import type { PoolClient } from 'pg';
import { nextRef } from './workOrders.js';
import { resolveSla, type Priority } from './sla.js';
import { ruleBasedTriage } from './ai.js';

/**
 * Self-service request / helpdesk intake (core CAFM — the primary demand channel).
 * Curators/wardens/contractors log issues; triage classifies and sets priority; on
 * conversion a work order is raised with the SLA due-date applied. See FMIQ-system-review §4.
 */

export interface RequestInput {
  description: string;
  channel?: 'web' | 'email' | 'qr' | 'phone' | 'mobile';
  requesterName?: string | null;
  requesterEmail?: string | null;
  requesterId?: string | null;
  spaceId?: string | null;
  assetId?: string | null;
}

export interface ServiceRequest {
  id: string;
  category: string;
  priority: Priority;
  status: string;
}

/** Create a request and auto-triage it (category + priority) with the rule-based engine. */
export async function createRequest(client: PoolClient, tenantId: string, input: RequestInput): Promise<ServiceRequest> {
  const triage = await ruleBasedTriage.triage(input.description);
  const { rows } = await client.query<ServiceRequest>(
    `INSERT INTO req_request (tenant_id, channel, requester_name, requester_email, requester_id, category, description, space_id, asset_id, priority, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'triaged')
     RETURNING id, category, priority, status`,
    [tenantId, input.channel ?? 'web', input.requesterName ?? null, input.requesterEmail ?? null, input.requesterId ?? null,
     triage.category, input.description, input.spaceId ?? null, input.assetId ?? null, triage.priority],
  );
  return rows[0];
}

export interface ConvertResult {
  requestId: string;
  workOrderId: string;
  ref: string;
  slaDue: string;
}

/** Convert a triaged request into a work order, applying the SLA tier for its priority. */
export async function convertRequest(client: PoolClient, tenantId: string, requestId: string): Promise<ConvertResult> {
  const { rows } = await client.query<{ description: string; category: string; priority: Priority; space_id: string | null; asset_id: string | null; status: string }>(
    `SELECT description, category, priority, space_id, asset_id, status FROM req_request WHERE id = $1`,
    [requestId],
  );
  const req = rows[0];
  if (!req) throw new Error('request not found');

  const sla = await resolveSla(client, tenantId, req.priority);
  const ref = await nextRef(client, tenantId);
  const wo = await client.query<{ id: string }>(
    `INSERT INTO wo_work_order (tenant_id, ref, space_id, asset_id, source, priority, status, title, sla_due, conservation_notes)
     VALUES ($1,$2,$3,$4,'reactive',$5,'open',$6,$7,$8) RETURNING id`,
    [tenantId, ref, req.space_id, req.asset_id, req.priority, `${req.category}: ${req.description.slice(0, 80)}`, sla.slaDue, req.description],
  );
  const workOrderId = wo.rows[0].id;
  await client.query(`UPDATE req_request SET status = 'converted', work_order_id = $2, sla_due = $3 WHERE id = $1`, [requestId, workOrderId, sla.slaDue]);
  await client.query(
    `INSERT INTO core_audit_log (tenant_id, entity, entity_id, action, after)
     VALUES ($1,'req_request',$2,'request.converted',$3)`,
    [tenantId, requestId, JSON.stringify({ workOrderId, ref, slaDue: sla.slaDue })],
  );
  return { requestId, workOrderId, ref, slaDue: sla.slaDue };
}
