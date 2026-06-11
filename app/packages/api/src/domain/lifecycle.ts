import type { PoolClient } from 'pg';

/**
 * Lifecycle costing / capital replacement (P2). Remaining-life forecast (design life
 * adjusted by condition), a replacement-due calendar, a costed risk-ranked backlog, and
 * a capital-bid gate (no bid without a recent condition survey) that seeds the CWMF
 * pipeline. See docs/FMIQ-master-build-plan.md §4.6.
 */

export class LifecycleError extends Error {
  constructor(public code: 'not_found' | 'survey_required', message: string) {
    super(message);
    this.name = 'LifecycleError';
  }
}

/** Condition multiplier on remaining design life (A best → D worst). */
const CONDITION_FACTOR: Record<string, number> = { A: 1.0, B: 0.8, C: 0.5, D: 0.2 };

/** Remaining useful life (years) from commission date, design life and condition grade. */
export function remainingLifeYears(
  input: { designLifeYears: number; commissionDate: string; conditionGrade?: string | null },
  now: Date = new Date(),
): number {
  const factor = CONDITION_FACTOR[input.conditionGrade ?? 'B'] ?? 0.8;
  const effectiveLife = input.designLifeYears * factor;
  const ageYears = (now.getTime() - new Date(input.commissionDate).getTime()) / (365.25 * 86_400_000);
  return Math.max(0, Math.round((effectiveLife - ageYears) * 10) / 10);
}

export interface ReplacementForecastItem {
  assetId: string;
  code: string;
  name: string;
  remainingYears: number;
  replacementCost: number;
}

/** Assets due for replacement within `horizonYears`, costed and soonest-first. */
export async function replacementForecast(client: PoolClient, _tenantId: string, horizonYears = 5, now: Date = new Date()): Promise<{ items: ReplacementForecastItem[]; total: number }> {
  const { rows } = await client.query<{
    id: string; code: string; name: string; design_life_years: number | null; replacement_cost: number | null; commission_date: string | null; condition_grade: string | null;
  }>(
    `SELECT id, code, name, design_life_years, replacement_cost, commission_date, condition_grade
       FROM est_asset WHERE design_life_years IS NOT NULL AND commission_date IS NOT NULL`,
  );
  const items: ReplacementForecastItem[] = [];
  for (const a of rows) {
    const remainingYears = remainingLifeYears({ designLifeYears: Number(a.design_life_years), commissionDate: a.commission_date!, conditionGrade: a.condition_grade }, now);
    if (remainingYears <= horizonYears) {
      items.push({ assetId: a.id, code: a.code, name: a.name, remainingYears, replacementCost: Number(a.replacement_cost ?? 0) });
    }
  }
  items.sort((x, y) => x.remainingYears - y.remainingYears);
  return { items, total: items.reduce((s, i) => s + i.replacementCost, 0) };
}

export async function addBacklogItem(
  client: PoolClient,
  tenantId: string,
  input: { assetId?: string | null; description: string; costEstimate?: number; riskScore?: number; collectionsRisk?: boolean },
): Promise<{ id: string }> {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO lcc_backlog (tenant_id, asset_id, description, cost_estimate, risk_score, collections_risk)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [tenantId, input.assetId ?? null, input.description, input.costEstimate ?? null, input.riskScore ?? 0, input.collectionsRisk ?? false],
  );
  return rows[0];
}

/** Total unfunded backlog € and the count of unfunded collections-risk items. */
export async function unfundedBacklog(client: PoolClient, _tenantId: string): Promise<{ total: number; criticalCount: number }> {
  const { rows } = await client.query<{ total: number; critical: number }>(
    `SELECT COALESCE(sum(cost_estimate),0) AS total,
            count(*) FILTER (WHERE collections_risk) AS critical
       FROM lcc_backlog WHERE funded = false`,
  );
  return { total: Number(rows[0].total), criticalCount: Number(rows[0].critical) };
}

/** Defer-vs-replace comparison (simple TCO heuristic). */
export function deferVsReplace(input: { replacementCost: number; annualReactiveCost: number; remainingYears: number }): { recommend: 'defer' | 'replace'; deferCost: number; replaceCost: number } {
  const deferCost = input.annualReactiveCost * Math.max(1, Math.min(3, input.remainingYears + 1));
  const replaceCost = input.replacementCost;
  return { recommend: deferCost < replaceCost && input.remainingYears > 0 ? 'defer' : 'replace', deferCost, replaceCost };
}

/**
 * Start a capital replacement bid — blocked unless the asset has a condition survey within
 * 24 months. On success, seed a CWMF project typed capital_replacement.
 */
export async function startCapitalBid(client: PoolClient, tenantId: string, assetId: string, now: Date = new Date()): Promise<{ projectId: string }> {
  const { rows } = await client.query<{ name: string; replacement_cost: number | null; condition_survey_date: string | null }>(
    `SELECT name, replacement_cost, condition_survey_date FROM est_asset WHERE id = $1`,
    [assetId],
  );
  const a = rows[0];
  if (!a) throw new LifecycleError('not_found', 'Asset not found.');
  const surveyOk = a.condition_survey_date != null &&
    (now.getTime() - new Date(a.condition_survey_date).getTime()) <= 24 * 30.4 * 86_400_000;
  if (!surveyOk) throw new LifecycleError('survey_required', 'A condition survey within 24 months is required before a capital bid.');

  const prj = await client.query<{ id: string }>(
    `INSERT INTO prj_project (tenant_id, name, cwmf_stage, budget, spend, status_rag)
     VALUES ($1,$2,'capital_replacement',$3,0,'green') RETURNING id`,
    [tenantId, `Replace: ${a.name}`, a.replacement_cost ?? 0],
  );
  await client.query(
    `INSERT INTO core_audit_log (tenant_id, entity, entity_id, action, after) VALUES ($1,'prj_project',$2,'lcc.capital_bid_started',$3)`,
    [tenantId, prj.rows[0].id, JSON.stringify({ assetId })],
  );
  return { projectId: prj.rows[0].id };
}
