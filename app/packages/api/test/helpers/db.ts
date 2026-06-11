// Shared test helpers for DB-backed suites.
//
// `RLS_TABLES` is the authoritative list of tenant-scoped, RLS-protected tables.
// **When you add a tenant table in a migration, add it here** — the isolation
// suite then automatically asserts tenant B sees zero of tenant A's rows in it.
import { randomUUID } from 'node:crypto';
import { pool } from '../../src/db/pool.js';
import { withTenant } from '../../src/db/withTenant.js';

/** Every tenant-scoped table with RLS (001_init + 002_gate_engine). Keep in sync with the migrations. */
export const RLS_TABLES = [
  'core_user',
  'core_user_role',
  'core_audit_log',
  'est_site',
  'est_building',
  'est_floor',
  'est_space',
  'est_asset',
  'cc_case',
  'cc_zone',
  'cc_zone_target',
  'cc_sensor',
  'cc_excursion',
  'cc_object_link',
  'cc_loan',
  'wo_contractor',
  'wo_work_order',
  'cmp_obligation',
  'prj_project',
  'gate_definition',
  'wo_gate_check',
  'evt_outbox',
  'core_counter',
  'cal_booking',
  'ntf_message',
  'ntf_confirmation',
  'wo_ppm_schedule',
  'wo_meter_reading',
  'cmp_certificate',
  'cmp_inspection',
  'cmp_inspection_item',
  'cmp_defect',
  'hs_rams',
  'hs_permit',
  'hs_competency',
  'hs_key_register',
  'hs_keyloan',
  'hs_pretask',
  'hs_incident',
  'apr_chain',
  'apr_requisition',
  'apr_step',
  'apr_commitment',
  'inv_part',
  'inv_stock',
  'inv_movement',
  'inv_requisition',
  'hov_handover',
  'hov_cert',
  'hov_warranty',
  'hov_cobie_import_log',
  'soft_spec',
  'soft_task',
  'soft_completion',
  'ipm_trap',
  'ipm_observation',
  'waste_record',
  'lcc_backlog',
  'sus_meter',
  'sus_reading',
  'sus_carbon',
  'sus_bizot_compliance',
  'req_request',
  'wo_sla_policy',
  'doc_document',
  'doc_version',
  'doc_link',
  'wo_issue_photo',
] as const;

/** A row inserted for a tenant, with a predicate that uniquely identifies it. */
export interface SeededRow {
  table: string;
  where: string;
  params: unknown[];
}

/** Create a tenant (core_tenant has no RLS) and return its id. */
export async function createTenant(name: string): Promise<string> {
  const slug = `${name}-${randomUUID().slice(0, 8)}`;
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO core_tenant (name, slug, plan_tier) VALUES ($1, $2, 'pilot') RETURNING id`,
    [name, slug],
  );
  return rows[0].id;
}

/**
 * Insert exactly one row into every RLS-protected table for a tenant, in FK order,
 * returning a predicate per row so a sibling tenant's view can be asserted empty.
 */
export async function seedOneRowPerTable(tenantId: string): Promise<SeededRow[]> {
  return withTenant(tenantId, async (c) => {
    const rows: SeededRow[] = [];
    const byId = (table: string, id: string) => rows.push({ table, where: 'id = $1', params: [id] });
    const ins = async (sql: string, params: unknown[]): Promise<string> =>
      (await c.query<{ id: string }>(sql, params)).rows[0].id;

    const roleId = (await c.query<{ id: string }>(`SELECT id FROM core_role WHERE code = 'ConservationOfficer'`)).rows[0].id;
    const stdId = (await c.query<{ id: string }>(`SELECT id FROM cc_standard WHERE code = 'ASHRAE_A'`)).rows[0].id;

    const userId = await ins(
      `INSERT INTO core_user (tenant_id, email, display_name) VALUES ($1, $2, 'Test User') RETURNING id`,
      [tenantId, `user-${randomUUID().slice(0, 8)}@test.local`],
    );
    byId('core_user', userId);

    await c.query(`INSERT INTO core_user_role (tenant_id, user_id, role_id) VALUES ($1, $2, $3)`, [tenantId, userId, roleId]);
    rows.push({ table: 'core_user_role', where: 'user_id = $1 AND role_id = $2', params: [userId, roleId] });

    byId('core_audit_log', await ins(`INSERT INTO core_audit_log (tenant_id, entity, action) VALUES ($1, 'test', 'seed') RETURNING id`, [tenantId]));

    const siteId = await ins(`INSERT INTO est_site (tenant_id, name) VALUES ($1, 'Site') RETURNING id`, [tenantId]);
    byId('est_site', siteId);
    const bldgId = await ins(`INSERT INTO est_building (tenant_id, site_id, name) VALUES ($1, $2, 'Building') RETURNING id`, [tenantId, siteId]);
    byId('est_building', bldgId);
    const floorId = await ins(`INSERT INTO est_floor (tenant_id, building_id, name) VALUES ($1, $2, 'Floor') RETURNING id`, [tenantId, bldgId]);
    byId('est_floor', floorId);
    const spaceId = await ins(`INSERT INTO est_space (tenant_id, floor_id, name, space_type) VALUES ($1, $2, 'Space', 'store') RETURNING id`, [tenantId, floorId]);
    byId('est_space', spaceId);
    const assetId = await ins(`INSERT INTO est_asset (tenant_id, space_id, code, name) VALUES ($1, $2, 'A-1', 'Asset') RETURNING id`, [tenantId, spaceId]);
    byId('est_asset', assetId);

    byId('cc_case', await ins(`INSERT INTO cc_case (tenant_id, space_id, name) VALUES ($1, $2, 'Case') RETURNING id`, [tenantId, spaceId]));
    const zoneId = await ins(`INSERT INTO cc_zone (tenant_id, space_id, name) VALUES ($1, $2, 'Zone') RETURNING id`, [tenantId, spaceId]);
    byId('cc_zone', zoneId);
    byId('cc_zone_target', await ins(`INSERT INTO cc_zone_target (tenant_id, cc_zone_id, cc_standard_id) VALUES ($1, $2, $3) RETURNING id`, [tenantId, zoneId, stdId]));
    byId('cc_sensor', await ins(`INSERT INTO cc_sensor (tenant_id, cc_zone_id, vendor, external_id) VALUES ($1, $2, 'conserv', 'EXT-1') RETURNING id`, [tenantId, zoneId]));
    byId('cc_excursion', await ins(`INSERT INTO cc_excursion (tenant_id, cc_zone_id, metric, kind, severity) VALUES ($1, $2, 'rh', 'absolute', 'breach') RETURNING id`, [tenantId, zoneId]));
    byId('cc_object_link', await ins(`INSERT INTO cc_object_link (tenant_id, cc_zone_id, cms_object_id, object_name) VALUES ($1, $2, 'O-1', 'Object') RETURNING id`, [tenantId, zoneId]));
    byId('cc_loan', await ins(`INSERT INTO cc_loan (tenant_id, cc_zone_id, lender) VALUES ($1, $2, 'Lender') RETURNING id`, [tenantId, zoneId]));

    const contractorId = await ins(`INSERT INTO wo_contractor (tenant_id, name) VALUES ($1, 'Contractor') RETURNING id`, [tenantId]);
    byId('wo_contractor', contractorId);
    const woId = await ins(
      `INSERT INTO wo_work_order (tenant_id, ref, space_id, source, title) VALUES ($1, $2, $3, 'reactive', 'WO') RETURNING id`,
      [tenantId, `WO-${randomUUID().slice(0, 8)}`, spaceId],
    );
    byId('wo_work_order', woId);

    byId('cmp_obligation', await ins(`INSERT INTO cmp_obligation (tenant_id, building_id, type) VALUES ($1, $2, 'fire') RETURNING id`, [tenantId, bldgId]));
    byId('prj_project', await ins(`INSERT INTO prj_project (tenant_id, name) VALUES ($1, 'Project') RETURNING id`, [tenantId]));

    byId('gate_definition', await ins(`INSERT INTO gate_definition (tenant_id, code, name) VALUES ($1, 'ssow_readiness', 'SSoW Readiness') RETURNING id`, [tenantId]));
    byId('wo_gate_check', await ins(
      `INSERT INTO wo_gate_check (tenant_id, work_order_id, gate_code, check_id, status) VALUES ($1, $2, 'ssow_readiness', 'work_order_exists', 'pass') RETURNING id`,
      [tenantId, woId],
    ));

    byId('evt_outbox', await ins(
      `INSERT INTO evt_outbox (tenant_id, event_type, payload, idempotency_key) VALUES ($1, 'test.seed', '{}'::jsonb, $2) RETURNING id`,
      [tenantId, `seed-${randomUUID()}`],
    ));

    // core_counter has a composite PK (tenant_id, scope) and no id — identify by a
    // tenant-unique scope so the isolation predicate matches exactly one tenant's row.
    const counterScope = `seed-${randomUUID()}`;
    await c.query(`INSERT INTO core_counter (tenant_id, scope, value) VALUES ($1, $2, 1)`, [tenantId, counterScope]);
    rows.push({ table: 'core_counter', where: `scope = $1`, params: [counterScope] });

    byId('cal_booking', await ins(
      `INSERT INTO cal_booking (tenant_id, booking_type, space_id, start_at, end_at)
       VALUES ($1, 'inspection', $2, now(), now() + interval '1 hour') RETURNING id`,
      [tenantId, spaceId],
    ));
    const msgId = await ins(
      `INSERT INTO ntf_message (tenant_id, subject, body) VALUES ($1, 'Seed', 'Seed body') RETURNING id`,
      [tenantId],
    );
    byId('ntf_message', msgId);
    byId('ntf_confirmation', await ins(
      `INSERT INTO ntf_confirmation (tenant_id, message_id) VALUES ($1, $2) RETURNING id`,
      [tenantId, msgId],
    ));

    const tplId = (await c.query<{ id: string }>(`SELECT id FROM wo_task_template WHERE code = 'FIRE-ALARM-Q'`)).rows[0].id;
    byId('wo_ppm_schedule', await ins(
      `INSERT INTO wo_ppm_schedule (tenant_id, asset_id, task_template_id, next_due) VALUES ($1, $2, $3, current_date) RETURNING id`,
      [tenantId, assetId, tplId],
    ));
    // wo_meter_reading has no id — identify by a tenant-unique meter_type.
    const meterType = `seed-${randomUUID()}`;
    await c.query(`INSERT INTO wo_meter_reading (tenant_id, asset_id, meter_type, value) VALUES ($1, $2, $3, 1)`, [tenantId, assetId, meterType]);
    rows.push({ table: 'wo_meter_reading', where: `meter_type = $1`, params: [meterType] });

    const certId = await ins(`INSERT INTO cmp_certificate (tenant_id, cert_type_code, building_id) VALUES ($1, 'fire_alarm', $2) RETURNING id`, [tenantId, bldgId]);
    byId('cmp_certificate', certId);
    const inspId = await ins(`INSERT INTO cmp_inspection (tenant_id, certificate_id, result) VALUES ($1, $2, 'pass') RETURNING id`, [tenantId, certId]);
    byId('cmp_inspection', inspId);
    byId('cmp_inspection_item', await ins(`INSERT INTO cmp_inspection_item (tenant_id, inspection_id, label, status) VALUES ($1, $2, 'Item', 'pass') RETURNING id`, [tenantId, inspId]));
    byId('cmp_defect', await ins(`INSERT INTO cmp_defect (tenant_id, inspection_id, severity) VALUES ($1, $2, 'low') RETURNING id`, [tenantId, inspId]));

    byId('hs_rams', await ins(`INSERT INTO hs_rams (tenant_id, work_order_id, title) VALUES ($1, $2, 'RAMS') RETURNING id`, [tenantId, woId]));
    byId('hs_permit', await ins(`INSERT INTO hs_permit (tenant_id, work_order_id, permit_type) VALUES ($1, $2, 'hot_works') RETURNING id`, [tenantId, woId]));
    byId('hs_competency', await ins(`INSERT INTO hs_competency (tenant_id, contractor_id, comp_type) VALUES ($1, $2, 'safe_pass') RETURNING id`, [tenantId, contractorId]));
    const keyId = await ins(`INSERT INTO hs_key_register (tenant_id, code, name) VALUES ($1, 'K1', 'Store key') RETURNING id`, [tenantId]);
    byId('hs_key_register', keyId);
    byId('hs_keyloan', await ins(`INSERT INTO hs_keyloan (tenant_id, key_id, work_order_id) VALUES ($1, $2, $3) RETURNING id`, [tenantId, keyId, woId]));
    byId('hs_pretask', await ins(`INSERT INTO hs_pretask (tenant_id, work_order_id) VALUES ($1, $2) RETURNING id`, [tenantId, woId]));
    byId('hs_incident', await ins(`INSERT INTO hs_incident (tenant_id, kind) VALUES ($1, 'near_miss') RETURNING id`, [tenantId]));

    const chainId = await ins(`INSERT INTO apr_chain (tenant_id, name, steps) VALUES ($1, 'Std', '["FacilitiesManager"]'::jsonb) RETURNING id`, [tenantId]);
    byId('apr_chain', chainId);
    const reqId = await ins(`INSERT INTO apr_requisition (tenant_id, chain_id, amount_net) VALUES ($1, $2, 100) RETURNING id`, [tenantId, chainId]);
    byId('apr_requisition', reqId);
    byId('apr_step', await ins(`INSERT INTO apr_step (tenant_id, requisition_id, step_order, approver_role) VALUES ($1, $2, 0, 'FacilitiesManager') RETURNING id`, [tenantId, reqId]));
    byId('apr_commitment', await ins(`INSERT INTO apr_commitment (tenant_id, requisition_id, amount_net) VALUES ($1, $2, 100) RETURNING id`, [tenantId, reqId]));

    const partId = await ins(`INSERT INTO inv_part (tenant_id, code, name) VALUES ($1, 'P-1', 'Part') RETURNING id`, [tenantId]);
    byId('inv_part', partId);
    byId('inv_stock', await ins(`INSERT INTO inv_stock (tenant_id, part_id, qty_on_hand, min_qty) VALUES ($1, $2, 5, 1) RETURNING id`, [tenantId, partId]));
    byId('inv_movement', await ins(`INSERT INTO inv_movement (tenant_id, part_id, movement_type, qty) VALUES ($1, $2, 'receipt', 5) RETURNING id`, [tenantId, partId]));
    byId('inv_requisition', await ins(`INSERT INTO inv_requisition (tenant_id, part_id, qty) VALUES ($1, $2, 3) RETURNING id`, [tenantId, partId]));

    const handoverId = await ins(`INSERT INTO hov_handover (tenant_id, building_id) VALUES ($1, $2) RETURNING id`, [tenantId, bldgId]);
    byId('hov_handover', handoverId);
    byId('hov_cert', await ins(`INSERT INTO hov_cert (tenant_id, handover_id, cert_type) VALUES ($1, $2, 'ccc') RETURNING id`, [tenantId, handoverId]));
    byId('hov_warranty', await ins(`INSERT INTO hov_warranty (tenant_id, handover_id) VALUES ($1, $2) RETURNING id`, [tenantId, handoverId]));
    byId('hov_cobie_import_log', await ins(`INSERT INTO hov_cobie_import_log (tenant_id, handover_id) VALUES ($1, $2) RETURNING id`, [tenantId, handoverId]));

    const specId = await ins(`INSERT INTO soft_spec (tenant_id, space_type, service) VALUES ($1, 'gallery', 'cleaning') RETURNING id`, [tenantId]);
    byId('soft_spec', specId);
    const softTaskId = await ins(`INSERT INTO soft_task (tenant_id, space_id, spec_id) VALUES ($1, $2, $3) RETURNING id`, [tenantId, spaceId, specId]);
    byId('soft_task', softTaskId);
    byId('soft_completion', await ins(`INSERT INTO soft_completion (tenant_id, task_id, qr_scan) VALUES ($1, $2, true) RETURNING id`, [tenantId, softTaskId]));
    const trapId = await ins(`INSERT INTO ipm_trap (tenant_id, space_id, code) VALUES ($1, $2, 'TRAP-1') RETURNING id`, [tenantId, spaceId]);
    byId('ipm_trap', trapId);
    byId('ipm_observation', await ins(`INSERT INTO ipm_observation (tenant_id, trap_id, count) VALUES ($1, $2, 0) RETURNING id`, [tenantId, trapId]));
    byId('waste_record', await ins(`INSERT INTO waste_record (tenant_id, building_id, stream) VALUES ($1, $2, 'general') RETURNING id`, [tenantId, bldgId]));
    byId('lcc_backlog', await ins(`INSERT INTO lcc_backlog (tenant_id, asset_id, description) VALUES ($1, $2, 'Backlog item') RETURNING id`, [tenantId, assetId]));

    const meterId = await ins(`INSERT INTO sus_meter (tenant_id, building_id, utility) VALUES ($1, $2, 'elec') RETURNING id`, [tenantId, bldgId]);
    byId('sus_meter', meterId);
    // sus_reading has no id — identify by its (tenant-unique) meter.
    await c.query(`INSERT INTO sus_reading (tenant_id, meter_id, value) VALUES ($1, $2, 100)`, [tenantId, meterId]);
    rows.push({ table: 'sus_reading', where: `meter_id = $1`, params: [meterId] });
    byId('sus_carbon', await ins(`INSERT INTO sus_carbon (tenant_id, building_id, scope, period, tco2e) VALUES ($1, $2, 2, '2026', 1.5) RETURNING id`, [tenantId, bldgId]));
    byId('sus_bizot_compliance', await ins(`INSERT INTO sus_bizot_compliance (tenant_id, period, pct_hours_in_band) VALUES ($1, '2026', 99) RETURNING id`, [tenantId]));

    byId('req_request', await ins(`INSERT INTO req_request (tenant_id, description) VALUES ($1, 'Seed request') RETURNING id`, [tenantId]));
    byId('wo_sla_policy', await ins(`INSERT INTO wo_sla_policy (tenant_id, name, priority, response_mins, fix_mins) VALUES ($1, 'Std', 'high', 240, 1440) RETURNING id`, [tenantId]));

    const docId = await ins(`INSERT INTO doc_document (tenant_id, title) VALUES ($1, 'Seed doc') RETURNING id`, [tenantId]);
    byId('doc_document', docId);
    byId('doc_version', await ins(`INSERT INTO doc_version (tenant_id, document_id, version_no, blob_uri) VALUES ($1, $2, 1, 'blob://seed') RETURNING id`, [tenantId, docId]));
    byId('doc_link', await ins(`INSERT INTO doc_link (tenant_id, document_id, entity_type, entity_id) VALUES ($1, $2, 'asset', $3) RETURNING id`, [tenantId, docId, assetId]));

    // QR issue capture (020).
    byId('wo_issue_photo', await ins(
      `INSERT INTO wo_issue_photo (tenant_id, work_order_id, url) VALUES ($1, $2, 'https://example.test/p.jpg') RETURNING id`,
      [tenantId, woId],
    ));

    return rows;
  });
}

/** Count rows matching `where` that are VISIBLE under the given tenant's RLS context. */
export async function visibleCount(
  tenantId: string,
  table: string,
  where: string,
  params: unknown[],
): Promise<number> {
  return withTenant(tenantId, async (c) => {
    const { rows } = await c.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${table} WHERE ${where}`, params);
    return rows[0].n;
  });
}
