import type { PoolClient } from 'pg';
import { emitEvent } from './outbox.js';

/**
 * QR mobile issue capture — Snapfix's differentiator, native.
 *
 * A frontline user scans the QR on an asset and reports a problem in one line,
 * optionally with a photo. FMIQ resolves the asset → its space/building/site,
 * raises a reactive work order with the location pre-filled, attaches the photo,
 * and emits a domain event. Designed for near-zero-friction capture (adoption is
 * the whole point), so `reporter_name` is free text — the reporter need not be a
 * fully provisioned user.
 *
 * Mirrors the other domain modules: `(client, tenantId, …)` inside `withTenant`.
 */

export interface ResolvedAsset {
  assetId: string;
  code: string;
  name: string;
  assetType: string | null;
  spaceId: string | null;
  location: string | null;   // "Space, Building, Site"
}

export interface CaptureInput {
  /** Identify the asset by its QR uid (preferred) or directly by id. */
  qrUid?: string;
  assetId?: string;
  description: string;
  priority?: 'routine' | 'high' | 'critical';
  reporterName?: string;
  photoUrl?: string;
  photoCaption?: string;
}

export interface CaptureResult {
  workOrderId: string;
  ref: string;
  asset: ResolvedAsset;
  priority: 'routine' | 'high' | 'critical';
  photoAttached: boolean;
}

export class IssueCaptureError extends Error {
  constructor(public code: 'asset_not_found' | 'no_identifier' | 'empty_description', message: string) {
    super(message);
    this.name = 'IssueCaptureError';
  }
}

/** Resolve an asset by QR uid, returning a human location string for the capture screen. */
export async function resolveAssetByQr(client: PoolClient, qrUid: string): Promise<ResolvedAsset | null> {
  const { rows } = await client.query(
    `SELECT a.id, a.code, a.name, a.asset_type, a.space_id,
            sp.name AS space_name, b.name AS building_name, st.name AS site_name
       FROM est_asset a
       LEFT JOIN est_space sp    ON sp.id = a.space_id
       LEFT JOIN est_floor f     ON f.id = sp.floor_id
       LEFT JOIN est_building b   ON b.id = f.building_id
       LEFT JOIN est_site st      ON st.id = b.site_id
      WHERE a.qr_uid = $1
      LIMIT 1`,
    [qrUid],
  );
  const r = rows[0];
  if (!r) return null;
  return toResolved(r);
}

async function resolveAssetById(client: PoolClient, assetId: string): Promise<ResolvedAsset | null> {
  const { rows } = await client.query(
    `SELECT a.id, a.code, a.name, a.asset_type, a.space_id,
            sp.name AS space_name, b.name AS building_name, st.name AS site_name
       FROM est_asset a
       LEFT JOIN est_space sp    ON sp.id = a.space_id
       LEFT JOIN est_floor f     ON f.id = sp.floor_id
       LEFT JOIN est_building b   ON b.id = f.building_id
       LEFT JOIN est_site st      ON st.id = b.site_id
      WHERE a.id = $1
      LIMIT 1`,
    [assetId],
  );
  const r = rows[0];
  if (!r) return null;
  return toResolved(r);
}

function toResolved(r: any): ResolvedAsset {
  const location = [r.space_name, r.building_name, r.site_name].filter(Boolean).join(', ') || null;
  return {
    assetId: r.id, code: r.code, name: r.name, assetType: r.asset_type,
    spaceId: r.space_id, location,
  };
}

/**
 * Capture a reported issue against an asset → a reactive work order (+ optional
 * photo). Throws IssueCaptureError on a missing identifier / empty text / unknown asset.
 */
export async function captureIssue(
  client: PoolClient,
  tenantId: string,
  input: CaptureInput,
): Promise<CaptureResult> {
  const description = (input.description ?? '').trim();
  if (!description) throw new IssueCaptureError('empty_description', 'A description is required.');
  if (!input.qrUid && !input.assetId) {
    throw new IssueCaptureError('no_identifier', 'Provide a qrUid or assetId.');
  }

  const asset = input.qrUid
    ? await resolveAssetByQr(client, input.qrUid)
    : await resolveAssetById(client, input.assetId!);
  if (!asset) throw new IssueCaptureError('asset_not_found', 'No asset matches the supplied identifier.');

  const priority = input.priority ?? 'routine';
  const ref = `WO-${40000 + Math.floor(Math.random() * 59999)}`;
  const title = description.length > 80 ? `${description.slice(0, 77)}…` : description;

  const wo = await client.query<{ id: string }>(
    `INSERT INTO wo_work_order
       (tenant_id, ref, space_id, asset_id, source, priority, title, conservation_notes,
        reported_via, reporter_name)
     VALUES ($1,$2,$3,$4,'reactive',$5,$6,$7,'qr',$8)
     RETURNING id`,
    [tenantId, ref, asset.spaceId, asset.assetId, priority, title, description, input.reporterName ?? null],
  );
  const workOrderId = wo.rows[0].id;

  let photoAttached = false;
  if (input.photoUrl) {
    await client.query(
      `INSERT INTO wo_issue_photo (tenant_id, work_order_id, url, caption) VALUES ($1,$2,$3,$4)`,
      [tenantId, workOrderId, input.photoUrl, input.photoCaption ?? null],
    );
    photoAttached = true;
  }

  await emitEvent(client, {
    tenantId,
    type: 'fmiq.workorder.reported',
    subject: workOrderId,
    idempotencyKey: `workorder.reported:${workOrderId}`,
    data: {
      ref, assetId: asset.assetId, assetCode: asset.code,
      location: asset.location, priority, via: 'qr', photoAttached,
    },
  });

  return { workOrderId, ref, asset, priority, photoAttached };
}
