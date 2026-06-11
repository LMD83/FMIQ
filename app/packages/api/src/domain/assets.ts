import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { toCsv } from './importEngine.js';

/**
 * Asset register domain logic (EP-1 + PRD-asset-register-import §4.2/§6). The Asset
 * Information Model is the spine every later module writes back to. Thin routes call
 * these `(client, tenantId, …)` functions.
 *
 * Note on tenant safety: FK checks (`space_id → est_space`) run as a system operation
 * and are NOT subject to RLS, so we explicitly verify referenced entities are visible
 * to the tenant before insert/update. RLS still governs all reads.
 *
 * No hard deletes: removal is `deleted_at` only, and every list/read filters on it.
 */

export type ConditionGrade = 'A' | 'B' | 'C' | 'D';
export type Criticality = 'critical' | 'high' | 'medium' | 'low';

export interface AssetInput {
  code: string;
  name: string;
  spaceId?: string | null;
  buildingId?: string | null;
  assetType?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  serialNo?: string | null;
  assetTag?: string | null;
  uniclassCode?: string | null;
  sfg20Ref?: string | null;
  installDate?: string | null;
  conditionGrade?: ConditionGrade | null;
  criticality?: Criticality | null;
  expectedLifeYears?: number | null;
  replacementCost?: number | null;
  warrantyExpiry?: string | null;
  qrUid?: string | null;
}

const ASSET_COLUMNS = `id, code, name, space_id, building_id, asset_type, manufacturer, model, serial_no,
  asset_tag, uniclass_code, sfg20_ref, install_date, condition_grade, criticality,
  expected_life_years, replacement_cost, warranty_expiry, qr_uid, parent_asset_id,
  import_session_id, source_row, created_at, updated_at`;

export interface Asset {
  id: string;
  code: string;
  name: string;
  space_id: string | null;
  building_id: string | null;
  asset_type: string | null;
  manufacturer: string | null;
  model: string | null;
  serial_no: string | null;
  asset_tag: string | null;
  uniclass_code: string | null;
  sfg20_ref: string | null;
  install_date: string | null;
  condition_grade: ConditionGrade | null;
  criticality: Criticality | null;
  expected_life_years: number | null;
  replacement_cost: number | null;
  warranty_expiry: string | null;
  qr_uid: string | null;
  parent_asset_id: string | null;
  import_session_id: string | null;
  source_row: number | null;
  created_at: string;
  updated_at: string;
}

export class AssetError extends Error {
  constructor(
    public code: 'space_not_found' | 'building_not_found' | 'not_found',
    message: string,
  ) {
    super(message);
    this.name = 'AssetError';
  }
}

async function assertSpaceVisible(client: PoolClient, spaceId: string): Promise<void> {
  const { rowCount } = await client.query(`SELECT 1 FROM est_space WHERE id = $1 AND deleted_at IS NULL`, [spaceId]);
  if (!rowCount) throw new AssetError('space_not_found', 'Space not found for this tenant.');
}

async function assertBuildingVisible(client: PoolClient, buildingId: string): Promise<void> {
  const { rowCount } = await client.query(`SELECT 1 FROM est_building WHERE id = $1 AND deleted_at IS NULL`, [buildingId]);
  if (!rowCount) throw new AssetError('building_not_found', 'Building not found for this tenant.');
}

async function writeAudit(
  client: PoolClient, tenantId: string, action: string, entityId: string,
  userId: string | null, before: unknown, after: unknown,
): Promise<void> {
  await client.query(
    `INSERT INTO core_audit_log (tenant_id, user_id, entity, entity_id, action, before, after)
     VALUES ($1,$2,'est_asset',$3,$4,$5,$6)`,
    [tenantId, userId, entityId, action, before == null ? null : JSON.stringify(before), JSON.stringify(after)],
  );
}

export async function createAsset(
  client: PoolClient, tenantId: string, input: AssetInput, actorUserId?: string,
): Promise<Asset> {
  if (input.spaceId) await assertSpaceVisible(client, input.spaceId);
  if (input.buildingId) await assertBuildingVisible(client, input.buildingId);
  const qrUid = input.qrUid ?? `FMIQ-${randomUUID()}`;
  const { rows } = await client.query<Asset>(
    `INSERT INTO est_asset (tenant_id, space_id, building_id, code, name, asset_type, manufacturer, model,
        serial_no, asset_tag, uniclass_code, sfg20_ref, install_date, condition_grade, criticality,
        expected_life_years, replacement_cost, warranty_expiry, qr_uid)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
     RETURNING ${ASSET_COLUMNS}`,
    [tenantId, input.spaceId ?? null, input.buildingId ?? null, input.code, input.name,
      input.assetType ?? null, input.manufacturer ?? null, input.model ?? null,
      input.serialNo ?? null, input.assetTag ?? null, input.uniclassCode ?? null, input.sfg20Ref ?? null,
      input.installDate ?? null, input.conditionGrade ?? null, input.criticality ?? null,
      input.expectedLifeYears ?? null, input.replacementCost ?? null, input.warrantyExpiry ?? null, qrUid],
  );
  await writeAudit(client, tenantId, 'asset.created', rows[0].id, actorUserId ?? null, null, rows[0]);
  return rows[0];
}

export async function getAsset(client: PoolClient, _tenantId: string, id: string): Promise<Asset | null> {
  const { rows } = await client.query<Asset>(
    `SELECT ${ASSET_COLUMNS} FROM est_asset WHERE id = $1 AND deleted_at IS NULL`, [id],
  );
  return rows[0] ?? null;
}

/** Detail view: asset + provenance panel (import session/file/row) + audit history. */
export async function getAssetDetail(client: PoolClient, tenantId: string, id: string): Promise<unknown | null> {
  const asset = await getAsset(client, tenantId, id);
  if (!asset) return null;
  let provenance: unknown = null;
  if (asset.import_session_id) {
    const { rows } = await client.query(
      `SELECT s.id AS session_id, s.committed_at, f.filename, u.display_name AS imported_by
         FROM imp_session s
         LEFT JOIN imp_file f ON f.session_id = s.id AND f.kind = 'original'
         LEFT JOIN core_user u ON u.id = s.created_by
        WHERE s.id = $1`, [asset.import_session_id]);
    provenance = rows[0] ? { ...rows[0], source_row: asset.source_row } : null;
  }
  const { rows: auditRows } = await client.query(
    `SELECT id, user_id, action, before, after, at
       FROM core_audit_log
      WHERE entity = 'est_asset' AND entity_id = $1
      ORDER BY at DESC LIMIT 100`, [id]);
  return { asset, provenance, audit: auditRows };
}

export interface AssetListFilter {
  q?: string;
  spaceId?: string;
  buildingId?: string;
  siteId?: string;
  assetType?: string;
  conditionGrade?: ConditionGrade;
  criticality?: Criticality;
  importSessionId?: string;
  limit?: number;
  offset?: number;
}

const LIST_WHERE = `
   a.deleted_at IS NULL
   AND ($1::text IS NULL OR a.name ILIKE '%'||$1||'%' OR a.code ILIKE '%'||$1||'%'
        OR a.asset_tag ILIKE '%'||$1||'%' OR a.serial_no ILIKE '%'||$1||'%'
        OR a.manufacturer ILIKE '%'||$1||'%' OR a.model ILIKE '%'||$1||'%')
   AND ($2::uuid IS NULL OR a.space_id = $2)
   AND ($3::uuid IS NULL OR b.id = $3 OR a.building_id = $3)
   AND ($4::uuid IS NULL OR st.id = $4)
   AND ($5::text IS NULL OR a.asset_type = $5)
   AND ($6::text IS NULL OR a.condition_grade = $6)
   AND ($7::text IS NULL OR a.criticality = $7)
   AND ($8::uuid IS NULL OR a.import_session_id = $8)`;

const LIST_JOINS = `
   FROM est_asset a
   LEFT JOIN est_space sp ON sp.id = a.space_id
   LEFT JOIN est_floor fl ON fl.id = sp.floor_id
   LEFT JOIN est_building b ON b.id = COALESCE(fl.building_id, a.building_id)
   LEFT JOIN est_site st ON st.id = b.site_id`;

function listParams(filter: AssetListFilter): unknown[] {
  return [
    filter.q ?? null, filter.spaceId ?? null, filter.buildingId ?? null, filter.siteId ?? null,
    filter.assetType ?? null, filter.conditionGrade ?? null, filter.criticality ?? null,
    filter.importSessionId ?? null,
  ];
}

export async function listAssets(
  client: PoolClient, _tenantId: string, filter: AssetListFilter = {},
): Promise<{ assets: Array<Asset & { location: string | null; building: string | null; site: string | null }>; total: number }> {
  const params = [...listParams(filter), Math.min(filter.limit ?? 100, 500), filter.offset ?? 0];
  const { rows } = await client.query<Asset & { location: string | null; building: string | null; site: string | null; total: string }>(
    `SELECT a.id, a.code, a.name, a.space_id, a.building_id, a.asset_type, a.manufacturer, a.model,
            a.serial_no, a.asset_tag, a.uniclass_code, a.sfg20_ref, a.install_date,
            a.condition_grade, a.criticality, a.expected_life_years, a.replacement_cost,
            a.warranty_expiry, a.qr_uid, a.parent_asset_id, a.import_session_id, a.source_row,
            a.created_at, a.updated_at,
            sp.name AS location, b.name AS building, st.name AS site,
            count(*) OVER () AS total
       ${LIST_JOINS}
      WHERE ${LIST_WHERE}
      ORDER BY a.code
      LIMIT $9 OFFSET $10`,
    params,
  );
  const total = rows.length > 0 ? Number(rows[0].total) : 0;
  return { assets: rows.map(({ total: _t, ...rest }) => rest), total };
}

/** Filtered register export — same predicate as listAssets, serialised as CSV (AC: register export). */
export async function exportAssetsCsv(client: PoolClient, tenantId: string, filter: AssetListFilter = {}): Promise<string> {
  // Page through the full filtered set in chunks to avoid unbounded memory.
  const all: Array<Asset & { location: string | null; building: string | null; site: string | null }> = [];
  let offset = filter.offset ?? 0;
  for (;;) {
    const page = await listAssets(client, tenantId, { ...filter, limit: 500, offset });
    all.push(...page.assets);
    if (page.assets.length < 500) break;
    offset += 500;
  }
  const headers = ['code', 'name', 'site', 'building', 'location', 'asset_type', 'manufacturer', 'model',
    'serial_no', 'asset_tag', 'uniclass_code', 'sfg20_ref', 'install_date', 'condition_grade',
    'criticality', 'expected_life_years', 'replacement_cost', 'warranty_expiry', 'qr_uid'];
  return toCsv(headers, all.map((a) => [
    a.code, a.name, a.site, a.building, a.location, a.asset_type, a.manufacturer, a.model,
    a.serial_no, a.asset_tag, a.uniclass_code, a.sfg20_ref, a.install_date, a.condition_grade,
    a.criticality, a.expected_life_years, a.replacement_cost, a.warranty_expiry, a.qr_uid,
  ]));
}

export type AssetUpdate = Partial<AssetInput>;

export async function updateAsset(
  client: PoolClient, tenantId: string, id: string, patch: AssetUpdate, actorUserId?: string,
): Promise<Asset> {
  const before = await getAsset(client, tenantId, id);
  if (!before) throw new AssetError('not_found', 'Asset not found.');
  if (patch.spaceId) await assertSpaceVisible(client, patch.spaceId);
  if (patch.buildingId) await assertBuildingVisible(client, patch.buildingId);

  // Coalesce: only provided fields change. (camelCase input → snake_case columns.)
  const { rows } = await client.query<Asset>(
    `UPDATE est_asset SET
        code = COALESCE($2, code),
        name = COALESCE($3, name),
        space_id = COALESCE($4, space_id),
        building_id = COALESCE($5, building_id),
        asset_type = COALESCE($6, asset_type),
        manufacturer = COALESCE($7, manufacturer),
        model = COALESCE($8, model),
        serial_no = COALESCE($9, serial_no),
        asset_tag = COALESCE($10, asset_tag),
        uniclass_code = COALESCE($11, uniclass_code),
        sfg20_ref = COALESCE($12, sfg20_ref),
        install_date = COALESCE($13, install_date),
        condition_grade = COALESCE($14, condition_grade),
        criticality = COALESCE($15, criticality),
        expected_life_years = COALESCE($16, expected_life_years),
        replacement_cost = COALESCE($17, replacement_cost),
        warranty_expiry = COALESCE($18, warranty_expiry),
        updated_at = now()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING ${ASSET_COLUMNS}`,
    [id, patch.code ?? null, patch.name ?? null, patch.spaceId ?? null, patch.buildingId ?? null,
      patch.assetType ?? null, patch.manufacturer ?? null, patch.model ?? null, patch.serialNo ?? null,
      patch.assetTag ?? null, patch.uniclassCode ?? null, patch.sfg20Ref ?? null, patch.installDate ?? null,
      patch.conditionGrade ?? null, patch.criticality ?? null, patch.expectedLifeYears ?? null,
      patch.replacementCost ?? null, patch.warrantyExpiry ?? null],
  );
  await writeAudit(client, tenantId, 'asset.updated', id, actorUserId ?? null, before, rows[0]);
  return rows[0];
}

/** Soft delete only — sets deleted_at; the row (and its audit trail) is retained. */
export async function softDeleteAsset(
  client: PoolClient, tenantId: string, id: string, actorUserId?: string,
): Promise<void> {
  const before = await getAsset(client, tenantId, id);
  if (!before) throw new AssetError('not_found', 'Asset not found.');
  await client.query(`UPDATE est_asset SET deleted_at = now(), updated_at = now() WHERE id = $1`, [id]);
  await writeAudit(client, tenantId, 'asset.deleted', id, actorUserId ?? null, before, { deleted: true });
}

/** Location hierarchy (Site → Building → Floor → Space) with asset counts per node. */
export async function locationTree(client: PoolClient, _tenantId: string): Promise<unknown[]> {
  const { rows: sites } = await client.query<{ id: string; name: string }>(
    `SELECT id, name FROM est_site WHERE deleted_at IS NULL ORDER BY name`);
  const { rows: buildings } = await client.query<{ id: string; name: string; site_id: string; direct_assets: number }>(
    `SELECT b.id, b.name, b.site_id,
            (SELECT count(*)::int FROM est_asset a WHERE a.building_id = b.id AND a.deleted_at IS NULL) AS direct_assets
       FROM est_building b WHERE b.deleted_at IS NULL ORDER BY b.name`);
  const { rows: floors } = await client.query<{ id: string; name: string; building_id: string; level_index: number }>(
    `SELECT id, name, building_id, level_index FROM est_floor WHERE deleted_at IS NULL ORDER BY level_index, name`);
  const { rows: spaces } = await client.query<{ id: string; name: string; floor_id: string; space_type: string; asset_count: number }>(
    `SELECT s.id, s.name, s.floor_id, s.space_type,
            (SELECT count(*)::int FROM est_asset a WHERE a.space_id = s.id AND a.deleted_at IS NULL) AS asset_count
       FROM est_space s WHERE s.deleted_at IS NULL ORDER BY s.name`);

  const spacesByFloor = groupBy(spaces, (s) => s.floor_id);
  const floorsByBuilding = groupBy(floors, (f) => f.building_id);
  const buildingsBySite = groupBy(buildings, (b) => b.site_id);

  return sites.map((site) => {
    const siteBuildings = (buildingsBySite.get(site.id) ?? []).map((b) => {
      const buildingFloors = (floorsByBuilding.get(b.id) ?? []).map((f) => {
        const floorSpaces = spacesByFloor.get(f.id) ?? [];
        return {
          id: f.id, name: f.name, levelIndex: f.level_index,
          assetCount: floorSpaces.reduce((n, s) => n + s.asset_count, 0),
          spaces: floorSpaces.map((s) => ({ id: s.id, name: s.name, spaceType: s.space_type, assetCount: s.asset_count })),
        };
      });
      const assetCount = b.direct_assets + buildingFloors.reduce((n, f) => n + f.assetCount, 0);
      return { id: b.id, name: b.name, assetCount, directAssets: b.direct_assets, floors: buildingFloors };
    });
    return {
      id: site.id, name: site.name,
      assetCount: siteBuildings.reduce((n, b) => n + b.assetCount, 0),
      buildings: siteBuildings,
    };
  });
}

function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    const arr = m.get(k);
    if (arr) arr.push(it); else m.set(k, [it]);
  }
  return m;
}

/** Direct children of an asset in the parent/child tree. */
export async function listAssetChildren(client: PoolClient, _tenantId: string, id: string): Promise<Asset[]> {
  const { rows } = await client.query<Asset>(
    `SELECT ${ASSET_COLUMNS} FROM est_asset WHERE parent_asset_id = $1 AND deleted_at IS NULL ORDER BY code`, [id]);
  return rows;
}

/** Payload encoded on the asset's QR/NFC tag — the primary field-navigation anchor. */
export function assetQrPayload(asset: Asset): { qrUid: string | null; assetId: string; code: string; name: string } {
  return { qrUid: asset.qr_uid, assetId: asset.id, code: asset.code, name: asset.name };
}
