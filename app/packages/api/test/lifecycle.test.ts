// P2 — lifecycle costing: remaining-life, replacement forecast, backlog, capital-bid gate.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pool } from '../src/db/pool.js';
import { withTenant } from '../src/db/withTenant.js';
import { createTenant } from './helpers/db.js';
import { addBacklogItem, deferVsReplace, LifecycleError, remainingLifeYears, replacementForecast, startCapitalBid, unfundedBacklog } from '../src/domain/lifecycle.js';

let tenant: string;
let spaceId: string;

beforeAll(async () => {
  tenant = await createTenant('lcc');
  await withTenant(tenant, async (c) => {
    const site = (await c.query<{ id: string }>(`INSERT INTO est_site (tenant_id, name) VALUES ($1,'S') RETURNING id`, [tenant])).rows[0].id;
    const b = (await c.query<{ id: string }>(`INSERT INTO est_building (tenant_id, site_id, name) VALUES ($1,$2,'B') RETURNING id`, [tenant, site])).rows[0].id;
    const f = (await c.query<{ id: string }>(`INSERT INTO est_floor (tenant_id, building_id, name) VALUES ($1,$2,'F') RETURNING id`, [tenant, b])).rows[0].id;
    spaceId = (await c.query<{ id: string }>(`INSERT INTO est_space (tenant_id, floor_id, name, space_type) VALUES ($1,$2,'P','plant') RETURNING id`, [tenant, f])).rows[0].id;
  });
});

afterAll(async () => {
  await pool.end();
});

async function makeAsset(o: { designLife?: number; commission?: string; grade?: string; cost?: number; survey?: string | null }): Promise<string> {
  return withTenant(tenant, async (c) =>
    (await c.query<{ id: string }>(
      `INSERT INTO est_asset (tenant_id, space_id, code, name, design_life_years, commission_date, condition_grade, replacement_cost, condition_survey_date)
       VALUES ($1,$2,$3,'Chiller',$4,$5,$6,$7,$8) RETURNING id`,
      [tenant, spaceId, `A-${Math.random().toString(36).slice(2, 7)}`, o.designLife ?? null, o.commission ?? null, o.grade ?? null, o.cost ?? null, o.survey ?? null],
    )).rows[0].id,
  );
}

describe('lifecycle calculations', () => {
  it('remaining life shrinks with worse condition', () => {
    const base = { designLifeYears: 20, commissionDate: '2016-01-01' };
    const a = remainingLifeYears({ ...base, conditionGrade: 'A' });
    const d = remainingLifeYears({ ...base, conditionGrade: 'D' });
    expect(a).toBeGreaterThan(d);
  });

  it('defer-vs-replace recommends replace when deferral is dearer', () => {
    expect(deferVsReplace({ replacementCost: 1000, annualReactiveCost: 800, remainingYears: 2 }).recommend).toBe('replace');
    expect(deferVsReplace({ replacementCost: 10000, annualReactiveCost: 200, remainingYears: 3 }).recommend).toBe('defer');
  });
});

describe('replacement forecast + backlog', () => {
  it('lists assets due within the horizon, costed', async () => {
    await makeAsset({ designLife: 10, commission: '2010-01-01', grade: 'C', cost: 50000 }); // well past life
    const f = await withTenant(tenant, (c) => replacementForecast(c, tenant, 5));
    expect(f.items.length).toBeGreaterThanOrEqual(1);
    expect(f.total).toBeGreaterThanOrEqual(50000);
  });

  it('sums unfunded backlog and counts collections-risk items', async () => {
    await withTenant(tenant, (c) => addBacklogItem(c, tenant, { description: 'Roof', costEstimate: 12000, collectionsRisk: true }));
    const b = await withTenant(tenant, (c) => unfundedBacklog(c, tenant));
    expect(b.total).toBeGreaterThanOrEqual(12000);
    expect(b.criticalCount).toBeGreaterThanOrEqual(1);
  });
});

describe('capital-bid gate', () => {
  it('blocks a bid without a recent condition survey', async () => {
    const asset = await makeAsset({ designLife: 15, commission: '2012-01-01', cost: 40000, survey: null });
    await expect(withTenant(tenant, (c) => startCapitalBid(c, tenant, asset))).rejects.toMatchObject({ code: 'survey_required' });
  });

  it('seeds a CWMF project when a recent survey exists', async () => {
    const recent = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
    const asset = await makeAsset({ designLife: 15, commission: '2012-01-01', cost: 40000, survey: recent });
    const { projectId } = await withTenant(tenant, (c) => startCapitalBid(c, tenant, asset));
    const prj = await withTenant(tenant, (c) => c.query<{ cwmf_stage: string; budget: number }>(`SELECT cwmf_stage, budget FROM prj_project WHERE id = $1`, [projectId]));
    expect(prj.rows[0].cwmf_stage).toBe('capital_replacement');
    expect(Number(prj.rows[0].budget)).toBe(40000);
  });

  it('throws not_found for an unknown asset', async () => {
    await expect(withTenant(tenant, (c) => startCapitalBid(c, tenant, '00000000-0000-0000-0000-0000000000ff'))).rejects.toBeInstanceOf(LifecycleError);
  });
});
