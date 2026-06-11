import type { PoolClient } from 'pg';
import { nextRef } from './workOrders.js';

/**
 * Compliance certificates & statutory checks (S7): a first-class certificate register
 * with escalating expiry alerts (90/60/30/7 days), and mobile inspections where a
 * failed item auto-raises a remedial work order (closed loop).
 * See docs/FMIQ-master-build-plan.md §4.4.
 */

export type ExpiryTier = 90 | 60 | 30 | 7;

/** The soonest alert tier a certificate `daysUntil` expiry falls into, or null. */
export function expiryTier(daysUntil: number): ExpiryTier | null {
  if (daysUntil <= 7) return 7;
  if (daysUntil <= 30) return 30;
  if (daysUntil <= 60) return 60;
  if (daysUntil <= 90) return 90;
  return null;
}

export interface CertificateInput {
  certTypeCode: string;
  ref?: string | null;
  issuer?: string | null;
  issueDate?: string | null;
  expiryDate?: string | null;
  buildingId?: string | null;
  assetId?: string | null;
  bcmsRef?: string | null;
  ownerId?: string | null;
}

export async function createCertificate(client: PoolClient, tenantId: string, input: CertificateInput): Promise<{ id: string }> {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO cmp_certificate (tenant_id, cert_type_code, ref, issuer, issue_date, expiry_date, building_id, asset_id, bcms_ref, owner_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [tenantId, input.certTypeCode, input.ref ?? null, input.issuer ?? null, input.issueDate ?? null, input.expiryDate ?? null, input.buildingId ?? null, input.assetId ?? null, input.bcmsRef ?? null, input.ownerId ?? null],
  );
  return rows[0];
}

export interface CertAlert {
  id: string;
  cert_type_code: string;
  ref: string | null;
  expiry_date: string;
  days_until: number;
  tier: ExpiryTier;
}

/** Valid certificates within 90 days of expiry, tagged with their alert tier. */
export async function certsDueForAlert(client: PoolClient, _tenantId: string, now: Date = new Date()): Promise<CertAlert[]> {
  const { rows } = await client.query<{ id: string; cert_type_code: string; ref: string | null; expiry_date: string; days_until: number }>(
    `SELECT id, cert_type_code, ref, expiry_date,
            (expiry_date - $1::date) AS days_until
       FROM cmp_certificate
      WHERE status = 'valid' AND expiry_date IS NOT NULL
        AND expiry_date <= ($1::date + interval '90 days')
      ORDER BY expiry_date`,
    [now.toISOString().slice(0, 10)],
  );
  return rows
    .map((r) => ({ ...r, days_until: Number(r.days_until), tier: expiryTier(Number(r.days_until)) }))
    .filter((r): r is CertAlert => r.tier !== null);
}

export interface InspectionItemInput {
  label: string;
  pass: boolean;
  photoUri?: string | null;
  note?: string | null;
}

export interface InspectionInput {
  obligationId?: string | null;
  certificateId?: string | null;
  spaceId?: string | null;
  performedBy?: string | null;
  items: InspectionItemInput[];
}

export interface InspectionResult {
  inspectionId: string;
  passed: boolean;
  remedialWorkOrderId?: string;
  defectId?: string;
}

/**
 * Record a mobile inspection. If any item fails, the inspection is a fail and a
 * defect + remedial work order are raised automatically (the closed loop).
 */
export async function recordInspection(client: PoolClient, tenantId: string, input: InspectionInput): Promise<InspectionResult> {
  const passed = input.items.every((i) => i.pass);
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO cmp_inspection (tenant_id, obligation_id, certificate_id, space_id, performed_by, result)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [tenantId, input.obligationId ?? null, input.certificateId ?? null, input.spaceId ?? null, input.performedBy ?? null, passed ? 'pass' : 'fail'],
  );
  const inspectionId = rows[0].id;
  for (const item of input.items) {
    await client.query(
      `INSERT INTO cmp_inspection_item (tenant_id, inspection_id, label, status, photo_uri, note) VALUES ($1,$2,$3,$4,$5,$6)`,
      [tenantId, inspectionId, item.label, item.pass ? 'pass' : 'fail', item.photoUri ?? null, item.note ?? null],
    );
  }

  await client.query(
    `INSERT INTO core_audit_log (tenant_id, user_id, entity, entity_id, action, after)
     VALUES ($1,$2,'cmp_inspection',$3,'inspection.recorded',$4)`,
    [tenantId, input.performedBy ?? null, inspectionId, JSON.stringify({ result: passed ? 'pass' : 'fail', items: input.items.length })],
  );

  if (passed) return { inspectionId, passed: true };

  // Failed inspection → remedial work order + defect.
  const ref = await nextRef(client, tenantId);
  const failed = input.items.filter((i) => !i.pass).map((i) => i.label).join('; ');
  const wo = await client.query<{ id: string }>(
    `INSERT INTO wo_work_order (tenant_id, ref, space_id, source, priority, status, title, conservation_notes)
     VALUES ($1,$2,$3,'inspection','high','open',$4,$5) RETURNING id`,
    [tenantId, ref, input.spaceId ?? null, 'Remedial works — failed inspection', `Failed checklist items: ${failed}.`],
  );
  const remedialWorkOrderId = wo.rows[0].id;
  const defect = await client.query<{ id: string }>(
    `INSERT INTO cmp_defect (tenant_id, inspection_id, severity, remedial_work_order_id) VALUES ($1,$2,'high',$3) RETURNING id`,
    [tenantId, inspectionId, remedialWorkOrderId],
  );
  return { inspectionId, passed: false, remedialWorkOrderId, defectId: defect.rows[0].id };
}
