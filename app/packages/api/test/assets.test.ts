// EP-1 asset register domain tests.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { pool } from '../src/db/pool.js';
import { withTenant } from '../src/db/withTenant.js';
import { createTenant } from './helpers/db.js';
import { AssetError, assetQrPayload, createAsset, getAsset, listAssets, updateAsset } from '../src/domain/assets.js';

let tenant: string;
let spaceId: string;
let otherTenantSpaceId: string;

beforeAll(async () => {
  tenant = await createTenant('assets');
  await withTenant(tenant, async (c) => {
    const site = (await c.query<{ id: string }>(`INSERT INTO est_site (tenant_id, name) VALUES ($1,'S') RETURNING id`, [tenant])).rows[0].id;
    const b = (await c.query<{ id: string }>(`INSERT INTO est_building (tenant_id, site_id, name) VALUES ($1,$2,'B') RETURNING id`, [tenant, site])).rows[0].id;
    const f = (await c.query<{ id: string }>(`INSERT INTO est_floor (tenant_id, building_id, name) VALUES ($1,$2,'F') RETURNING id`, [tenant, b])).rows[0].id;
    spaceId = (await c.query<{ id: string }>(`INSERT INTO est_space (tenant_id, floor_id, name, space_type) VALUES ($1,$2,'Plant Room','plant') RETURNING id`, [tenant, f])).rows[0].id;
  });
  const other = await createTenant('assets-other');
  await withTenant(other, async (c) => {
    const site = (await c.query<{ id: string }>(`INSERT INTO est_site (tenant_id, name) VALUES ($1,'S') RETURNING id`, [other])).rows[0].id;
    const b = (await c.query<{ id: string }>(`INSERT INTO est_building (tenant_id, site_id, name) VALUES ($1,$2,'B') RETURNING id`, [other, site])).rows[0].id;
    const f = (await c.query<{ id: string }>(`INSERT INTO est_floor (tenant_id, building_id, name) VALUES ($1,$2,'F') RETURNING id`, [other, b])).rows[0].id;
    otherTenantSpaceId = (await c.query<{ id: string }>(`INSERT INTO est_space (tenant_id, floor_id, name, space_type) VALUES ($1,$2,'Other','plant') RETURNING id`, [other, f])).rows[0].id;
  });
});

afterAll(async () => {
  await pool.end();
});

describe('asset register', () => {
  it('creates an asset, auto-generating a QR uid', async () => {
    const asset = await withTenant(tenant, (c) => createAsset(c, tenant, { code: 'AHU-01', name: 'Air handling unit', spaceId, conditionGrade: 'B' }));
    expect(asset.code).toBe('AHU-01');
    expect(asset.qr_uid).toMatch(/^FMIQ-/);
    expect(asset.condition_grade).toBe('B');
  });

  it('writes an audit row on create', async () => {
    const asset = await withTenant(tenant, (c) => createAsset(c, tenant, { code: 'PUMP-1', name: 'Pump', spaceId }, randomUUID()));
    const audit = await withTenant(tenant, (c) => c.query<{ n: number }>(`SELECT count(*)::int AS n FROM core_audit_log WHERE entity = 'est_asset' AND entity_id = $1 AND action = 'asset.created'`, [asset.id]));
    expect(audit.rows[0].n).toBe(1);
  });

  it('gets and lists assets, with location join and space filter', async () => {
    const created = await withTenant(tenant, (c) => createAsset(c, tenant, { code: 'CH-1', name: 'Chiller', spaceId }));
    const fetched = await withTenant(tenant, (c) => getAsset(c, tenant, created.id));
    expect(fetched?.id).toBe(created.id);
    const list = await withTenant(tenant, (c) => listAssets(c, tenant, { spaceId }));
    expect(list.find((a) => a.id === created.id)?.location).toBe('Plant Room');
  });

  it('updates only the provided fields and audits before/after', async () => {
    const a = await withTenant(tenant, (c) => createAsset(c, tenant, { code: 'BLR-1', name: 'Boiler', spaceId, conditionGrade: 'A' }));
    const updated = await withTenant(tenant, (c) => updateAsset(c, tenant, a.id, { conditionGrade: 'C' }));
    expect(updated.condition_grade).toBe('C');
    expect(updated.name).toBe('Boiler'); // unchanged
    const audit = await withTenant(tenant, (c) => c.query<{ n: number }>(`SELECT count(*)::int AS n FROM core_audit_log WHERE entity_id = $1 AND action = 'asset.updated'`, [a.id]));
    expect(audit.rows[0].n).toBe(1);
  });

  it('rejects attaching an asset to another tenant’s space (FK bypasses RLS)', async () => {
    await expect(
      withTenant(tenant, (c) => createAsset(c, tenant, { code: 'X', name: 'X', spaceId: otherTenantSpaceId })),
    ).rejects.toMatchObject({ code: 'space_not_found' });
  });

  it('404s update of an unknown asset', async () => {
    await expect(
      withTenant(tenant, (c) => updateAsset(c, tenant, '00000000-0000-0000-0000-0000000000ff', { name: 'x' })),
    ).rejects.toBeInstanceOf(AssetError);
  });

  it('builds a QR payload', async () => {
    const a = await withTenant(tenant, (c) => createAsset(c, tenant, { code: 'QR-1', name: 'Tagged', spaceId }));
    const payload = assetQrPayload(a);
    expect(payload).toMatchObject({ assetId: a.id, code: 'QR-1', name: 'Tagged' });
    expect(payload.qrUid).toMatch(/^FMIQ-/);
  });
});
