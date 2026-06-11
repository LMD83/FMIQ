import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { createSchedule, proposeTemplates } from './ppm.js';
import type { ParsedCobie } from '../adapters/cobie.js';

/**
 * Handover Gate (P2 headline differentiator). Completion becomes the event that
 * populates operations: the Irish cert chain gates go-live, and COBie auto-creates
 * assets + PPM schedules + warranties + spares. A building certified Friday is fully
 * managed Monday, zero re-keying. See docs/lifecycle-and-simplicity.md §1.
 */

/** Certs that must be present + validated before go-live (CCC also needs a BCMS ref). */
export const REQUIRED_CERTS = ['ccc', 'fsc', 'dac', 'safety_file'] as const;

export class HandoverError extends Error {
  constructor(public code: 'not_found' | 'go_live_blocked', message: string) {
    super(message);
    this.name = 'HandoverError';
  }
}

export async function createHandover(client: PoolClient, tenantId: string, input: { projectId?: string | null; buildingId?: string | null }): Promise<{ id: string }> {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO hov_handover (tenant_id, project_id, building_id) VALUES ($1,$2,$3) RETURNING id`,
    [tenantId, input.projectId ?? null, input.buildingId ?? null],
  );
  return rows[0];
}

export async function addCert(
  client: PoolClient,
  tenantId: string,
  input: { handoverId: string; certType: string; reference?: string | null; bcmsRef?: string | null; validated?: boolean },
): Promise<{ id: string }> {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO hov_cert (tenant_id, handover_id, cert_type, reference, bcms_ref, validated) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [tenantId, input.handoverId, input.certType, input.reference ?? null, input.bcmsRef ?? null, input.validated ?? false],
  );
  return rows[0];
}

export interface GateStatus {
  goLiveBlocked: boolean;
  cobieComplete: boolean;
  present: string[];
  missing: string[];
  required: number;
  satisfied: number;
}

/** The go-live gate: every required cert validated (CCC needs a BCMS ref) AND COBie imported. */
export async function handoverGateStatus(client: PoolClient, _tenantId: string, handoverId: string): Promise<GateStatus> {
  const ho = await client.query<{ cobie_import_status: string }>(`SELECT cobie_import_status FROM hov_handover WHERE id = $1`, [handoverId]);
  if (!ho.rows[0]) throw new HandoverError('not_found', 'Handover not found.');
  const cobieComplete = ho.rows[0].cobie_import_status === 'complete';

  const { rows: certs } = await client.query<{ cert_type: string; validated: boolean; bcms_ref: string | null }>(
    `SELECT cert_type, validated, bcms_ref FROM hov_cert WHERE handover_id = $1`,
    [handoverId],
  );
  const present: string[] = [];
  for (const req of REQUIRED_CERTS) {
    const matches = certs.filter((x) => x.cert_type === req && x.validated);
    // CCC must additionally carry a BCMS reference (S.I. 9/2014).
    const ok = req === 'ccc' ? matches.some((c) => c.bcms_ref != null && c.bcms_ref.length > 0) : matches.length > 0;
    if (ok) present.push(req);
  }
  const missing = REQUIRED_CERTS.filter((r) => !present.includes(r)).map((r) => r as string);
  if (!cobieComplete) missing.push('cobie_import');
  return {
    goLiveBlocked: missing.length > 0,
    cobieComplete,
    present,
    missing,
    required: REQUIRED_CERTS.length + 1,
    satisfied: present.length + (cobieComplete ? 1 : 0),
  };
}

export interface CobieImportResult {
  components: number;
  schedules: number;
  warranties: number;
  spares: number;
}

/**
 * Import a COBie dataset into live operations: create assets, auto-propose PPM schedules
 * from each asset's type (SFG20 lookup → compliance clock starts), warranties, and spares;
 * mark the handover's COBie status complete and log the counts.
 */
export async function importCobie(
  client: PoolClient,
  tenantId: string,
  handoverId: string,
  cobie: ParsedCobie,
  opts: { defaultSpaceId?: string | null } = {},
): Promise<CobieImportResult> {
  let schedules = 0;
  let warranties = 0;
  for (const c of cobie.components) {
    const code = `${c.type.slice(0, 4).toUpperCase()}-${randomUUID().slice(0, 6)}`;
    const asset = await client.query<{ id: string }>(
      `INSERT INTO est_asset (tenant_id, space_id, code, name, asset_type, manufacturer, install_date, qr_uid)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [tenantId, opts.defaultSpaceId ?? null, code, c.name, c.type, c.manufacturer ?? null, c.installDate ?? null, `FMIQ-${randomUUID()}`],
    );
    const assetId = asset.rows[0].id;

    // Auto-propose PPM from the asset type (the "PPM schedules created" headline).
    const templates = await proposeTemplates(client, c.type);
    if (templates[0]) {
      await createSchedule(client, tenantId, {
        assetId,
        taskTemplateId: templates[0].id,
        nextDue: (c.installDate ?? new Date().toISOString().slice(0, 10)).slice(0, 10),
      });
      schedules += 1;
    }

    // Warranty from the COBie warranty duration.
    if (c.warrantyMonths && c.installDate) {
      await client.query(
        `INSERT INTO hov_warranty (tenant_id, handover_id, asset_id, supplier, starts, ends)
         VALUES ($1,$2,$3,$4,$5::date, ($5::date + ($6 || ' months')::interval))`,
        [tenantId, handoverId, assetId, c.manufacturer ?? null, c.installDate, c.warrantyMonths],
      );
      warranties += 1;
    }
  }

  // Spares → parts catalogue (+ zero stock line).
  for (const s of cobie.spares) {
    const part = await client.query<{ id: string }>(
      `INSERT INTO inv_part (tenant_id, code, name, manufacturer) VALUES ($1,$2,$3,$4) RETURNING id`,
      [tenantId, s.partNumber ?? `SP-${randomUUID().slice(0, 6)}`, s.name, s.manufacturer ?? null],
    );
    await client.query(`INSERT INTO inv_stock (tenant_id, part_id, qty_on_hand, min_qty) VALUES ($1,$2,0,1)`, [tenantId, part.rows[0].id]);
  }

  await client.query(`UPDATE hov_handover SET cobie_import_status = 'complete' WHERE id = $1`, [handoverId]);
  await client.query(
    `INSERT INTO hov_cobie_import_log (tenant_id, handover_id, components_imported, schedules_created, warranties_created, spares_imported)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [tenantId, handoverId, cobie.components.length, schedules, warranties, cobie.spares.length],
  );
  await client.query(
    `INSERT INTO core_audit_log (tenant_id, entity, entity_id, action, after)
     VALUES ($1,'hov_handover',$2,'handover.cobie_imported',$3)`,
    [tenantId, handoverId, JSON.stringify({ components: cobie.components.length, schedules, warranties, spares: cobie.spares.length })],
  );

  return { components: cobie.components.length, schedules, warranties, spares: cobie.spares.length };
}

/** Take the building live — only if the gate is green. */
export async function goLive(client: PoolClient, tenantId: string, handoverId: string): Promise<GateStatus> {
  const status = await handoverGateStatus(client, tenantId, handoverId);
  if (status.goLiveBlocked) {
    throw new HandoverError('go_live_blocked', `Go-live blocked — missing: ${status.missing.join(', ')}`);
  }
  await client.query(`UPDATE hov_handover SET status = 'live', went_live_at = now() WHERE id = $1`, [handoverId]);
  await client.query(
    `INSERT INTO core_audit_log (tenant_id, entity, entity_id, action, after) VALUES ($1,'hov_handover',$2,'handover.went_live','{}'::jsonb)`,
    [tenantId, handoverId],
  );
  return status;
}
