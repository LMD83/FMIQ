import type { PoolClient } from 'pg';

/**
 * Revenue eTax Clearance verification (S.I. 463/2012). A public body cannot engage a
 * non-tax-compliant contractor, so the SSoW Readiness Gate reads the recorded status.
 *
 * The real verification is a Revenue SOAP web service keyed on the contractor's TCAN;
 * here it's a pluggable port. Call `verifyAndRecord` when a contractor is added and on
 * a daily re-check; the gate check (gateEngine `tax_clearance_valid`) does the blocking.
 * See FMIQ-integration-map.md §2.
 */

export type TaxClearanceStatus = 'valid' | 'expired' | 'revoked' | 'suspended' | 'unknown';

export interface TaxClearanceGateway {
  /** Verify a TCAN with Revenue. */
  verify(tcan: string): Promise<TaxClearanceStatus>;
}

/** Deferred integration: returns 'unknown' (no live Revenue call yet). */
export const nullTaxClearanceGateway: TaxClearanceGateway = {
  async verify() {
    return 'unknown';
  },
};

export async function recordTaxClearance(
  client: PoolClient,
  tenantId: string,
  contractorId: string,
  status: TaxClearanceStatus,
  tcan?: string | null,
): Promise<void> {
  await client.query(
    `UPDATE wo_contractor SET tax_clearance_status = $2, tax_clearance_checked_at = now(), tcan = COALESCE($3, tcan) WHERE id = $1`,
    [contractorId, status, tcan ?? null],
  );
  await client.query(
    `INSERT INTO core_audit_log (tenant_id, entity, entity_id, action, after)
     VALUES ($1,'wo_contractor',$2,'tax_clearance.checked',$3)`,
    [tenantId, contractorId, JSON.stringify({ status })],
  );
}

/** Verify a contractor's TCAN via the gateway and persist the result. */
export async function verifyAndRecord(
  client: PoolClient,
  tenantId: string,
  contractorId: string,
  gateway: TaxClearanceGateway = nullTaxClearanceGateway,
): Promise<TaxClearanceStatus> {
  const { rows } = await client.query<{ tcan: string | null }>(`SELECT tcan FROM wo_contractor WHERE id = $1`, [contractorId]);
  if (!rows[0]) throw new Error('contractor not found');
  const status: TaxClearanceStatus = rows[0].tcan ? await gateway.verify(rows[0].tcan) : 'unknown';
  await recordTaxClearance(client, tenantId, contractorId, status);
  return status;
}
