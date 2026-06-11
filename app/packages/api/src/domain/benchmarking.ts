import type { PoolClient } from 'pg';

/**
 * Multi-institution benchmarking (P3). Compares a tenant's KPIs against an anonymised
 * cohort — "you're in the top quartile for statutory PPM on-time." Pure comparison
 * primitives + own-tenant metrics; cross-tenant cohort aggregation runs under the
 * analytics (fmiq_read) role, never the request path (RLS isolation is preserved).
 */

/** Percentile rank of `value` within `cohort` (0–100; % of cohort ≤ value). */
export function percentileRank(value: number, cohort: number[]): number {
  if (cohort.length === 0) return 100;
  const atOrBelow = cohort.filter((c) => c <= value).length;
  return Math.round((atOrBelow / cohort.length) * 100);
}

export interface BenchmarkResult {
  value: number;
  cohortAvg: number;
  percentile: number;
  quartile: 1 | 2 | 3 | 4;
}

export function compareToCohort(value: number, cohort: number[]): BenchmarkResult {
  const cohortAvg = cohort.length ? Math.round((cohort.reduce((a, b) => a + b, 0) / cohort.length) * 10) / 10 : value;
  const percentile = percentileRank(value, cohort);
  const quartile = (percentile >= 75 ? 4 : percentile >= 50 ? 3 : percentile >= 25 ? 2 : 1) as 1 | 2 | 3 | 4;
  return { value, cohortAvg, percentile, quartile };
}

export interface TenantKpis {
  statutoryPpmPct: number;
  openWorkOrders: number;
  activeExcursions: number;
}

/** A tenant's own benchmarkable KPIs (computed within its RLS scope). */
export async function tenantKpis(client: PoolClient, _tenantId: string): Promise<TenantKpis> {
  const { rows } = await client.query<{ ppm_total: number; ppm_overdue: number; open_wo: number; excursions: number }>(
    `SELECT
       (SELECT count(*) FROM wo_ppm_schedule WHERE active AND statutory_flag)                          AS ppm_total,
       (SELECT count(*) FROM wo_ppm_schedule WHERE active AND statutory_flag AND next_due < current_date) AS ppm_overdue,
       (SELECT count(*) FROM wo_work_order WHERE status <> 'closed')                                    AS open_wo,
       (SELECT count(*) FROM cc_excursion WHERE ended_at IS NULL)                                       AS excursions`,
  );
  const r = rows[0];
  const total = Number(r.ppm_total);
  const statutoryPpmPct = total === 0 ? 100 : Math.round(((total - Number(r.ppm_overdue)) / total) * 100);
  return { statutoryPpmPct, openWorkOrders: Number(r.open_wo), activeExcursions: Number(r.excursions) };
}
