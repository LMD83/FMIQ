// Core CAFM — one-click evidence packs assembled from live data + print-ready HTML.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { pool } from '../src/db/pool.js';
import { withTenant } from '../src/db/withTenant.js';
import { createTenant } from './helpers/db.js';
import { registerDocument, linkDocument } from '../src/domain/documents.js';
import { renderEvidenceHtml, workOrderEvidencePack } from '../src/domain/evidence.js';

let tenant: string;
let woId: string;

beforeAll(async () => {
  tenant = await createTenant('evid');
  await withTenant(tenant, async (c) => {
    const site = (await c.query<{ id: string }>(`INSERT INTO est_site (tenant_id, name) VALUES ($1,'S') RETURNING id`, [tenant])).rows[0].id;
    const b = (await c.query<{ id: string }>(`INSERT INTO est_building (tenant_id, site_id, name) VALUES ($1,$2,'B') RETURNING id`, [tenant, site])).rows[0].id;
    const f = (await c.query<{ id: string }>(`INSERT INTO est_floor (tenant_id, building_id, name) VALUES ($1,$2,'F') RETURNING id`, [tenant, b])).rows[0].id;
    const sp = (await c.query<{ id: string }>(`INSERT INTO est_space (tenant_id, floor_id, name, space_type) VALUES ($1,$2,'Plant','plant') RETURNING id`, [tenant, f])).rows[0].id;
    const asset = (await c.query<{ id: string }>(`INSERT INTO est_asset (tenant_id, space_id, code, name) VALUES ($1,$2,'AHU-9','AHU 9') RETURNING id`, [tenant, sp])).rows[0].id;
    const contractor = (await c.query<{ id: string }>(`INSERT INTO wo_contractor (tenant_id, name) VALUES ($1,'Mercury HVAC') RETURNING id`, [tenant])).rows[0].id;

    woId = (await c.query<{ id: string }>(
      `INSERT INTO wo_work_order (tenant_id, ref, space_id, asset_id, contractor_id, source, priority, status, title, opened_at, closed_at, sla_due)
       VALUES ($1,'WO-2026-09001',$2,$3,$4,'reactive','high','closed','Belt replacement', now()-interval '2 days', now()-interval '1 day', now())
       RETURNING id`,
      [tenant, sp, asset, contractor],
    )).rows[0].id;

    await c.query(`INSERT INTO wo_gate_check (tenant_id, work_order_id, gate_code, check_id, status) VALUES ($1,$2,'ssow_readiness','rams_approved','pass')`, [tenant, woId]);
    await c.query(`INSERT INTO wo_gate_check (tenant_id, work_order_id, gate_code, check_id, status) VALUES ($1,$2,'ssow_readiness','permit_active','pass')`, [tenant, woId]);
    await c.query(`INSERT INTO hs_rams (tenant_id, work_order_id, title, status) VALUES ($1,$2,'Belt change RAMS','approved')`, [tenant, woId]);
    await c.query(`INSERT INTO hs_permit (tenant_id, work_order_id, permit_type, status) VALUES ($1,$2,'electrical_isolation','closed')`, [tenant, woId]);
    await c.query(`INSERT INTO cmp_certificate (tenant_id, cert_type_code, asset_id, status) VALUES ($1,'electrical',$2,'valid')`, [tenant, asset]);
    await c.query(`INSERT INTO core_audit_log (tenant_id, entity, entity_id, action) VALUES ($1,'wo_work_order',$2,'work_order.closed')`, [tenant, woId]);
  });
  // Link a golden-thread document to the work order.
  const doc = await withTenant(tenant, (c) => registerDocument(c, tenant, { title: 'Belt datasheet', docType: 'datasheet', blobUri: 'blob://belt.pdf' }));
  await withTenant(tenant, (c) => linkDocument(c, tenant, doc.id, 'work_order', woId));
});

afterAll(async () => {
  await pool.end();
});

describe('work order evidence pack', () => {
  it('assembles the full chain from live data', async () => {
    const pack = await withTenant(tenant, (c) => workOrderEvidencePack(c, woId));
    expect(pack.workOrder.ref).toBe('WO-2026-09001');
    expect(pack.workOrder.asset).toBe('AHU 9');
    expect(pack.workOrder.contractor).toBe('Mercury HVAC');
    expect(pack.workOrder.slaOutcome).toBe('met'); // closed before due
    expect(pack.gateChecks).toHaveLength(2);
    expect(pack.rams[0].status).toBe('approved');
    expect(pack.permits[0].permit_type).toBe('electrical_isolation');
    expect(pack.documents.map((d) => d.title)).toContain('Belt datasheet');
    expect(pack.certificates.map((c) => c.cert_type_code)).toContain('electrical');
    expect(pack.auditTrail.some((a) => a.action === 'work_order.closed')).toBe(true);
  });

  it('throws for an unknown work order', async () => {
    await expect(withTenant(tenant, (c) => workOrderEvidencePack(c, randomUUID()))).rejects.toThrow('work order not found');
  });

  it('renders accessible, self-contained, escaped HTML', async () => {
    const pack = await withTenant(tenant, (c) => workOrderEvidencePack(c, woId));
    const html = renderEvidenceHtml(pack);
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('WO-2026-09001');
    expect(html).toContain('Safe-system-of-work gate checks');
    expect(html).toContain('Belt datasheet');
    expect(html).toContain('lang="en"');
    expect(html).toContain('@media print');
  });

  it('escapes HTML in user-provided fields', async () => {
    const evilWoId = await withTenant(tenant, async (c) => {
      return (await c.query<{ id: string }>(
        `INSERT INTO wo_work_order (tenant_id, ref, source, status, title) VALUES ($1,$2,'reactive','open',$3) RETURNING id`,
        [tenant, `WO-${randomUUID().slice(0, 8)}`, '<script>alert(1)</script>'],
      )).rows[0].id;
    });
    const pack = await withTenant(tenant, (c) => workOrderEvidencePack(c, evilWoId));
    const html = renderEvidenceHtml(pack);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
