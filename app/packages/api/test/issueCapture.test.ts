// QR mobile issue capture — resolve by QR, raise a reactive work order with the
// location pre-filled, attach a photo, emit an event, and reject bad input.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pool } from '../src/db/pool.js';
import { withTenant } from '../src/db/withTenant.js';
import { createTenant } from './helpers/db.js';
import { captureIssue, resolveAssetByQr, IssueCaptureError } from '../src/domain/issueCapture.js';

let tenant: string;
let assetId: string;
const qr = `QR-${Math.random().toString(36).slice(2, 10)}`;

beforeAll(async () => {
  tenant = await createTenant('issue-tenant');
  await withTenant(tenant, async (c) => {
    const site = (await c.query<{ id: string }>(`INSERT INTO est_site (tenant_id, name) VALUES ($1,'Collins Barracks') RETURNING id`, [tenant])).rows[0].id;
    const b = (await c.query<{ id: string }>(`INSERT INTO est_building (tenant_id, site_id, name) VALUES ($1,$2,'West Block') RETURNING id`, [tenant, site])).rows[0].id;
    const f = (await c.query<{ id: string }>(`INSERT INTO est_floor (tenant_id, building_id, name) VALUES ($1,$2,'Ground') RETURNING id`, [tenant, b])).rows[0].id;
    const sp = (await c.query<{ id: string }>(`INSERT INTO est_space (tenant_id, floor_id, name, space_type) VALUES ($1,$2,'Gallery 3','gallery') RETURNING id`, [tenant, f])).rows[0].id;
    assetId = (await c.query<{ id: string }>(
      `INSERT INTO est_asset (tenant_id, space_id, code, name, asset_type, qr_uid) VALUES ($1,$2,'RAD-7','Radiator','heating',$3) RETURNING id`,
      [tenant, sp, qr],
    )).rows[0].id;
  });
});

afterAll(async () => {
  await pool.end();
});

describe('QR issue capture', () => {
  it('resolves an asset (with location) by QR uid', async () => {
    const asset = await withTenant(tenant, (c) => resolveAssetByQr(c, qr));
    expect(asset).not.toBeNull();
    expect(asset!.code).toBe('RAD-7');
    expect(asset!.location).toBe('Gallery 3, West Block, Collins Barracks');
  });

  it('captures an issue by QR → reactive work order with photo + event', async () => {
    const res = await withTenant(tenant, (c) =>
      captureIssue(c, tenant, {
        qrUid: qr,
        description: 'Radiator leaking onto the gallery floor near a display case',
        priority: 'high',
        reporterName: 'Front of House',
        photoUrl: 'https://example.test/leak.jpg',
      }),
    );
    expect(res.ref).toMatch(/^WO-/);
    expect(res.photoAttached).toBe(true);
    expect(res.asset.code).toBe('RAD-7');

    const wo = await withTenant(tenant, (c) =>
      c.query<{ source: string; reported_via: string; priority: string; asset_id: string }>(
        `SELECT source, reported_via, priority, asset_id FROM wo_work_order WHERE id = $1`,
        [res.workOrderId],
      ),
    );
    expect(wo.rows[0]).toMatchObject({ source: 'reactive', reported_via: 'qr', priority: 'high', asset_id: assetId });

    const photo = await withTenant(tenant, (c) =>
      c.query<{ n: number }>(`SELECT count(*)::int AS n FROM wo_issue_photo WHERE work_order_id = $1`, [res.workOrderId]),
    );
    expect(photo.rows[0].n).toBe(1);

    const ev = await withTenant(tenant, (c) =>
      c.query<{ n: number }>(`SELECT count(*)::int AS n FROM evt_outbox WHERE event_type = 'fmiq.workorder.reported'`),
    );
    expect(ev.rows[0].n).toBeGreaterThanOrEqual(1);
  });

  it('captures by assetId when no QR is used', async () => {
    const res = await withTenant(tenant, (c) =>
      captureIssue(c, tenant, { assetId, description: 'Intermittent buzzing noise' }),
    );
    expect(res.priority).toBe('routine');
    expect(res.photoAttached).toBe(false);
  });

  it('rejects empty description / missing identifier / unknown asset', async () => {
    await expect(withTenant(tenant, (c) => captureIssue(c, tenant, { qrUid: qr, description: '  ' })))
      .rejects.toBeInstanceOf(IssueCaptureError);
    await expect(withTenant(tenant, (c) => captureIssue(c, tenant, { description: 'no id' })))
      .rejects.toBeInstanceOf(IssueCaptureError);
    await expect(withTenant(tenant, (c) => captureIssue(c, tenant, { qrUid: 'does-not-exist', description: 'x' })))
      .rejects.toBeInstanceOf(IssueCaptureError);
  });
});
