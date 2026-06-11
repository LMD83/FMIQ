// Core CAFM — document / O&M management (the golden thread): register, version, link, surface.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pool } from '../src/db/pool.js';
import { withTenant } from '../src/db/withTenant.js';
import { createTenant } from './helpers/db.js';
import {
  addVersion, documentVersions, goldenThread, linkDocument, listDocuments, registerDocument,
} from '../src/domain/documents.js';

let tenant: string;
let assetId: string;

beforeAll(async () => {
  tenant = await createTenant('docs');
  await withTenant(tenant, async (c) => {
    const site = (await c.query<{ id: string }>(`INSERT INTO est_site (tenant_id, name) VALUES ($1,'S') RETURNING id`, [tenant])).rows[0].id;
    const b = (await c.query<{ id: string }>(`INSERT INTO est_building (tenant_id, site_id, name) VALUES ($1,$2,'B') RETURNING id`, [tenant, site])).rows[0].id;
    const f = (await c.query<{ id: string }>(`INSERT INTO est_floor (tenant_id, building_id, name) VALUES ($1,$2,'F') RETURNING id`, [tenant, b])).rows[0].id;
    const sp = (await c.query<{ id: string }>(`INSERT INTO est_space (tenant_id, floor_id, name, space_type) VALUES ($1,$2,'Plant','plant') RETURNING id`, [tenant, f])).rows[0].id;
    assetId = (await c.query<{ id: string }>(`INSERT INTO est_asset (tenant_id, space_id, code, name) VALUES ($1,$2,'AHU-1','AHU') RETURNING id`, [tenant, sp])).rows[0].id;
  });
});

afterAll(async () => {
  await pool.end();
});

describe('document register + versioning', () => {
  it('registers a document with version 1 as current', async () => {
    const doc = await withTenant(tenant, (c) => registerDocument(c, tenant, {
      title: 'AHU-1 O&M Manual', docType: 'om_manual', goldenThread: true, blobUri: 'blob://ahu-om-v1.pdf', fileName: 'ahu-om-v1.pdf',
    }));
    expect(doc.versionNo).toBe(1);
    expect(doc.currentVersionId).toBeTruthy();
    expect(doc.status).toBe('current');
    const ver = await withTenant(tenant, (c) => c.query<{ is_current: boolean }>(`SELECT is_current FROM doc_version WHERE id = $1`, [doc.currentVersionId]));
    expect(ver.rows[0].is_current).toBe(true);
  });

  it('adds a new version, supersedes the prior one, and updates the current pointer', async () => {
    const doc = await withTenant(tenant, (c) => registerDocument(c, tenant, { title: 'Fire cert', docType: 'certificate', blobUri: 'blob://fire-v1.pdf' }));
    const v2 = await withTenant(tenant, (c) => addVersion(c, tenant, doc.id, { blobUri: 'blob://fire-v2.pdf', notes: 'reissued' }));
    expect(v2.versionNo).toBe(2);

    const versions = await withTenant(tenant, (c) => documentVersions(c, doc.id));
    expect(versions.map((v) => v.version_no)).toEqual([2, 1]);
    expect(versions.find((v) => v.version_no === 2)?.is_current).toBe(true);
    expect(versions.find((v) => v.version_no === 1)?.is_current).toBe(false);

    const cur = await withTenant(tenant, (c) => c.query<{ current_version_id: string }>(`SELECT current_version_id FROM doc_document WHERE id = $1`, [doc.id]));
    expect(cur.rows[0].current_version_id).toBe(v2.versionId);
  });
});

describe('golden thread', () => {
  it('surfaces all current documents linked to an asset', async () => {
    const om = await withTenant(tenant, (c) => registerDocument(c, tenant, { title: 'Pump O&M', docType: 'om_manual', blobUri: 'blob://pump.pdf' }));
    const warranty = await withTenant(tenant, (c) => registerDocument(c, tenant, { title: 'Pump warranty', docType: 'warranty', blobUri: 'blob://warr.pdf' }));
    await withTenant(tenant, (c) => linkDocument(c, tenant, om.id, 'asset', assetId));
    await withTenant(tenant, (c) => linkDocument(c, tenant, warranty.id, 'asset', assetId));
    // idempotent — linking again does not duplicate
    await withTenant(tenant, (c) => linkDocument(c, tenant, om.id, 'asset', assetId));

    const thread = await withTenant(tenant, (c) => goldenThread(c, 'asset', assetId));
    const titles = thread.map((d) => d.title);
    expect(titles).toContain('Pump O&M');
    expect(titles).toContain('Pump warranty');
    expect(thread.filter((d) => d.title === 'Pump O&M')).toHaveLength(1);
  });
});

describe('listing + filters', () => {
  it('filters by golden_thread flag', async () => {
    const list = await withTenant(tenant, (c) => listDocuments(c, { goldenThread: true }));
    expect(list.every((d) => d.golden_thread === true)).toBe(true);
    expect(list.some((d) => d.title === 'AHU-1 O&M Manual')).toBe(true);
  });
});
