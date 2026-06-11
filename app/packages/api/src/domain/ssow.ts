import type { PoolClient } from 'pg';

/**
 * Safe System of Work helpers (S8–S9). Thin writers for the records the SSoW Readiness
 * Gate checks (src/domain/gateEngine.ts) read: RAMS, permits, competencies, pre-task
 * plans, key sign-out, incidents. See docs/FMIQ-master-build-plan.md §5.
 */

export async function createRams(client: PoolClient, tenantId: string, input: { workOrderId: string; title: string; validTo?: string | null }): Promise<{ id: string }> {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO hs_rams (tenant_id, work_order_id, title, valid_to) VALUES ($1,$2,$3,$4) RETURNING id`,
    [tenantId, input.workOrderId, input.title, input.validTo ?? null],
  );
  return rows[0];
}

export async function approveRams(client: PoolClient, tenantId: string, ramsId: string, approverId: string): Promise<void> {
  await client.query(`UPDATE hs_rams SET status = 'approved', approved_by = $2, approved_at = now() WHERE id = $1`, [ramsId, approverId]);
  await client.query(
    `INSERT INTO core_audit_log (tenant_id, user_id, entity, entity_id, action, after) VALUES ($1,$2,'hs_rams',$3,'rams.approved','{}'::jsonb)`,
    [tenantId, approverId, ramsId],
  );
}

export async function issuePermit(client: PoolClient, tenantId: string, input: { workOrderId: string; permitType: string; authoriserId: string; validTo?: string | null }): Promise<{ id: string }> {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO hs_permit (tenant_id, work_order_id, permit_type, status, valid_from, valid_to, authoriser_id)
     VALUES ($1,$2,$3,'active', now(), $4, $5) RETURNING id`,
    [tenantId, input.workOrderId, input.permitType, input.validTo ?? null, input.authoriserId],
  );
  return rows[0];
}

export async function addCompetency(client: PoolClient, tenantId: string, input: { contractorId?: string | null; userId?: string | null; compType: string; expiry?: string | null; reference?: string | null; issuedOn?: string | null; verified?: boolean }): Promise<{ id: string }> {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO hs_competency (tenant_id, contractor_id, user_id, comp_type, expiry, reference, issued_on, verified)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [tenantId, input.contractorId ?? null, input.userId ?? null, input.compType, input.expiry ?? null, input.reference ?? null, input.issuedOn ?? null, input.verified ?? false],
  );
  return rows[0];
}

/**
 * Contractor compliance vault — one row per contractor with their document counts, so a
 * facilities manager can see at a glance who is clear to work. valid = in-date (or no
 * expiry); expired = past expiry — the same condition the SSoW gate auto-blocks on.
 */
export interface ContractorVaultRow {
  id: string;
  name: string;
  prequal_status: string | null;
  insurance_expiry: string | null;
  total_docs: number;
  valid_docs: number;
  expired_docs: number;
  unverified_docs: number;
  next_expiry: string | null;
}

export async function contractorVault(client: PoolClient, _tenantId: string): Promise<ContractorVaultRow[]> {
  const { rows } = await client.query<ContractorVaultRow>(
    `SELECT c.id, c.name, c.prequal_status,
            to_char(c.insurance_expiry, 'YYYY-MM-DD') AS insurance_expiry,
            count(d.id)::int AS total_docs,
            count(d.id) FILTER (WHERE d.expiry IS NULL OR d.expiry >= current_date)::int AS valid_docs,
            count(d.id) FILTER (WHERE d.expiry IS NOT NULL AND d.expiry < current_date)::int AS expired_docs,
            count(d.id) FILTER (WHERE NOT d.verified)::int AS unverified_docs,
            to_char(min(d.expiry) FILTER (WHERE d.expiry >= current_date), 'YYYY-MM-DD') AS next_expiry
       FROM wo_contractor c
       LEFT JOIN hs_competency d ON d.contractor_id = c.id
      GROUP BY c.id, c.name, c.prequal_status, c.insurance_expiry
      ORDER BY expired_docs DESC, c.name ASC`,
  );
  return rows;
}

export async function completePretask(client: PoolClient, tenantId: string, input: { workOrderId: string; byUser?: string | null; newHazard?: boolean }): Promise<{ id: string }> {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO hs_pretask (tenant_id, work_order_id, by_user, new_hazard) VALUES ($1,$2,$3,$4) RETURNING id`,
    [tenantId, input.workOrderId, input.byUser ?? null, input.newHazard ?? false],
  );
  return rows[0];
}

export async function signOutKey(client: PoolClient, tenantId: string, input: { keyId: string; workOrderId: string; byUser?: string | null }): Promise<{ id: string }> {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO hs_keyloan (tenant_id, key_id, work_order_id, signed_out_by) VALUES ($1,$2,$3,$4) RETURNING id`,
    [tenantId, input.keyId, input.workOrderId, input.byUser ?? null],
  );
  return rows[0];
}

export async function reportIncident(client: PoolClient, tenantId: string, input: { spaceId?: string | null; kind?: 'incident' | 'near_miss'; reporterType?: string | null; riddorReportable?: boolean }): Promise<{ id: string }> {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO hs_incident (tenant_id, space_id, kind, reporter_type, riddor_reportable) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [tenantId, input.spaceId ?? null, input.kind ?? 'incident', input.reporterType ?? null, input.riddorReportable ?? false],
  );
  return rows[0];
}
