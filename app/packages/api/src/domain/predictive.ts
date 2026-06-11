import type { PoolClient } from 'pg';

/**
 * Predictive maintenance (P3) — a statistical risk model (no LLM). Combines asset
 * condition, reactive-failure frequency, and meter-runtime trend into a 0–100 health
 * risk score, surfacing the assets most likely to fail. Heritage HVAC is weighted by
 * conservation criticality. See docs/FMIQ-spec-irish-regulatory.md §3.2.
 */

export interface HealthScore {
  assetId: string;
  code: string;
  name: string;
  score: number; // 0 (healthy) – 100 (imminent risk)
  risk: 'low' | 'medium' | 'high';
  drivers: string[];
}

/** Least-squares slope (units/day) of a time series. Positive = rising. */
export function trendSlope(points: { ts: string; value: number }[]): number {
  if (points.length < 2) return 0;
  const xs = points.map((p) => new Date(p.ts).getTime() / 86_400_000);
  const ys = points.map((p) => p.value);
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  return den === 0 ? 0 : Math.round((num / den) * 1000) / 1000;
}

const CONDITION_BASE: Record<string, number> = { A: 10, B: 25, C: 50, D: 75 };

export async function assetHealth(client: PoolClient, _tenantId: string, assetId: string, now: Date = new Date()): Promise<HealthScore | null> {
  const { rows } = await client.query<{ code: string; name: string; condition_grade: string | null; criticality: string | null }>(
    `SELECT code, name, condition_grade, criticality FROM est_asset WHERE id = $1`,
    [assetId],
  );
  const a = rows[0];
  if (!a) return null;

  const drivers: string[] = [];
  let score = CONDITION_BASE[a.condition_grade ?? 'B'] ?? 25;
  if (a.condition_grade === 'D' || a.condition_grade === 'C') drivers.push(`condition grade ${a.condition_grade}`);

  // Reactive-failure frequency (last 180 days) — repeated reactive WOs signal decline.
  const since = new Date(now.getTime() - 180 * 86_400_000).toISOString();
  const wo = await client.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM wo_work_order WHERE asset_id = $1 AND source = 'reactive' AND opened_at >= $2`,
    [assetId, since],
  );
  const reactive = wo.rows[0].n;
  if (reactive > 0) {
    score += Math.min(30, reactive * 8);
    drivers.push(`${reactive} reactive failure(s) in 180d`);
  }

  // Meter-runtime trend — a rising trend (e.g. energy/vibration) raises risk.
  const meters = await client.query<{ ts: string; value: number }>(
    `SELECT ts, value::float8 AS value FROM wo_meter_reading WHERE asset_id = $1 ORDER BY ts`,
    [assetId],
  );
  if (meters.rows.length >= 2 && trendSlope(meters.rows) > 0) {
    score += 15;
    drivers.push('rising meter trend');
  }

  // Conservation-critical assets weighted up.
  if ((a.criticality ?? '').toLowerCase().includes('critical')) {
    score += 10;
    drivers.push('collection-critical asset');
  }

  score = Math.max(0, Math.min(100, score));
  const risk: HealthScore['risk'] = score >= 66 ? 'high' : score >= 33 ? 'medium' : 'low';
  return { assetId, code: a.code, name: a.name, score, risk, drivers };
}

/** The N highest-risk assets (predicted-failure leaderboard). */
export async function failurePredictions(client: PoolClient, tenantId: string, limit = 10): Promise<HealthScore[]> {
  const { rows } = await client.query<{ id: string }>(`SELECT id FROM est_asset ORDER BY code LIMIT 500`);
  const scored: HealthScore[] = [];
  for (const r of rows) {
    const h = await assetHealth(client, tenantId, r.id);
    if (h) scored.push(h);
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}
