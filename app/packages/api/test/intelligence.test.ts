// P3 — predictive maintenance, AI triage (rule-based + parse), benchmarking.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pool } from '../src/db/pool.js';
import { withTenant } from '../src/db/withTenant.js';
import { createTenant } from './helpers/db.js';
import { assetHealth, failurePredictions, trendSlope } from '../src/domain/predictive.js';
import { normaliseTriage, ruleBasedTriage } from '../src/domain/ai.js';
import { compareToCohort, percentileRank } from '../src/domain/benchmarking.js';

describe('AI triage (rule-based + normalisation)', () => {
  it('classifies common fault reports', async () => {
    expect((await ruleBasedTriage.triage('Smoke alarm going off in Gallery 3')).priority).toBe('critical');
    expect((await ruleBasedTriage.triage('Water leak above the print room')).category).toBe('water');
    expect((await ruleBasedTriage.triage('Casemaking moth seen in the textile store')).category).toBe('collection_care');
    expect((await ruleBasedTriage.triage('Squeaky door hinge')).priority).toBe('routine');
  });

  it('normalises an untrusted LLM payload', () => {
    expect(normaliseTriage({ category: 'fire', priority: 'nonsense', summary: '' }, 'fallback')).toEqual({ category: 'fire', priority: 'routine', summary: 'fallback' });
    expect(normaliseTriage({}, 'fb').category).toBe('general');
  });
});

describe('benchmarking', () => {
  it('computes percentile rank and quartile', () => {
    expect(percentileRank(95, [80, 85, 90, 95, 100])).toBe(80);
    const b = compareToCohort(95, [60, 70, 80, 90]);
    expect(b.quartile).toBe(4);
    expect(b.cohortAvg).toBe(75);
  });
});

describe('predictive maintenance', () => {
  let tenant: string;
  let spaceId: string;

  beforeAll(async () => {
    tenant = await createTenant('pred');
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

  it('trendSlope detects a rising series', () => {
    expect(trendSlope([{ ts: '2026-01-01', value: 1 }, { ts: '2026-01-11', value: 11 }])).toBeCloseTo(1, 1);
    expect(trendSlope([{ ts: '2026-01-01', value: 5 }])).toBe(0);
  });

  it('scores a failing asset higher than a healthy one', async () => {
    const healthyId = await withTenant(tenant, async (c) =>
      (await c.query<{ id: string }>(`INSERT INTO est_asset (tenant_id, space_id, code, name, condition_grade) VALUES ($1,$2,'OK-1','Good','A') RETURNING id`, [tenant, spaceId])).rows[0].id,
    );
    const failingId = await withTenant(tenant, async (c) => {
      const id = (await c.query<{ id: string }>(`INSERT INTO est_asset (tenant_id, space_id, code, name, condition_grade) VALUES ($1,$2,'BAD-1','Bad','D') RETURNING id`, [tenant, spaceId])).rows[0].id;
      for (let i = 0; i < 3; i++) {
        await c.query(`INSERT INTO wo_work_order (tenant_id, ref, asset_id, source, title, opened_at) VALUES ($1,$2,$3,'reactive','fix', now())`, [tenant, `WO-${Math.random().toString(36).slice(2, 8)}`, id]);
      }
      return id;
    });

    const healthy = await withTenant(tenant, (c) => assetHealth(c, tenant, healthyId));
    const failing = await withTenant(tenant, (c) => assetHealth(c, tenant, failingId));
    expect(failing!.score).toBeGreaterThan(healthy!.score);
    expect(failing!.risk).toBe('high');

    const board = await withTenant(tenant, (c) => failurePredictions(c, tenant));
    expect(board[0].assetId).toBe(failingId); // highest risk first
  });
});
