import type { PoolClient } from 'pg';

/**
 * Role dashboard aggregates (S12). Cross-module read models for the Director / FM /
 * Conservation / Finance front doors. All tenant-scoped via RLS. Read-only.
 * See docs/FMIQ-master-build-plan.md §8.3.
 */

export interface OpsSummary {
  openWorkOrders: number;
  ppmDue: number;
  certsExpiringSoon: number;
  activeExcursions: number;
  committedSpend: number;
}

export async function opsSummary(client: PoolClient, _tenantId: string): Promise<OpsSummary> {
  const { rows } = await client.query<{
    open_work_orders: number; ppm_due: number; certs_expiring: number; active_excursions: number; committed: number;
  }>(
    `SELECT
       (SELECT count(*) FROM wo_work_order WHERE status <> 'closed')                                         AS open_work_orders,
       (SELECT count(*) FROM wo_ppm_schedule WHERE active = true AND next_due IS NOT NULL
                          AND next_due <= current_date + (lead_days || ' days')::interval)                   AS ppm_due,
       (SELECT count(*) FROM cmp_certificate WHERE status = 'valid' AND expiry_date IS NOT NULL
                          AND expiry_date <= current_date + interval '90 days')                              AS certs_expiring,
       (SELECT count(*) FROM cc_excursion WHERE ended_at IS NULL)                                            AS active_excursions,
       (SELECT COALESCE(sum(amount_net),0) FROM apr_commitment WHERE status = 'committed')                   AS committed`,
  );
  const r = rows[0];
  return {
    openWorkOrders: Number(r.open_work_orders),
    ppmDue: Number(r.ppm_due),
    certsExpiringSoon: Number(r.certs_expiring),
    activeExcursions: Number(r.active_excursions),
    committedSpend: Number(r.committed),
  };
}

/** Statutory PPM on-time % (a headline pilot KPI). 100 when nothing is overdue. */
export async function statutoryPpmCompliance(client: PoolClient, _tenantId: string): Promise<number> {
  const { rows } = await client.query<{ total: number; overdue: number }>(
    `SELECT count(*) FILTER (WHERE statutory_flag) AS total,
            count(*) FILTER (WHERE statutory_flag AND next_due < current_date) AS overdue
       FROM wo_ppm_schedule WHERE active = true`,
  );
  const total = Number(rows[0].total);
  if (total === 0) return 100;
  return Math.round(((total - Number(rows[0].overdue)) / total) * 100);
}
