// Core CAFM — self-service helpdesk intake, SLA engine, contractor scorecards.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pool } from '../src/db/pool.js';
import { withTenant } from '../src/db/withTenant.js';
import { createTenant } from './helpers/db.js';
import { convertRequest, createRequest } from '../src/domain/requests.js';
import { contractorScorecard, resolveSla, setSlaPolicy, slaState } from '../src/domain/sla.js';

let tenant: string;
let spaceId: string;

beforeAll(async () => {
  tenant = await createTenant('help');
  await withTenant(tenant, async (c) => {
    const site = (await c.query<{ id: string }>(`INSERT INTO est_site (tenant_id, name) VALUES ($1,'S') RETURNING id`, [tenant])).rows[0].id;
    const b = (await c.query<{ id: string }>(`INSERT INTO est_building (tenant_id, site_id, name) VALUES ($1,$2,'B') RETURNING id`, [tenant, site])).rows[0].id;
    const f = (await c.query<{ id: string }>(`INSERT INTO est_floor (tenant_id, building_id, name) VALUES ($1,$2,'F') RETURNING id`, [tenant, b])).rows[0].id;
    spaceId = (await c.query<{ id: string }>(`INSERT INTO est_space (tenant_id, floor_id, name, space_type) VALUES ($1,$2,'Gallery','gallery') RETURNING id`, [tenant, f])).rows[0].id;
  });
});

afterAll(async () => {
  await pool.end();
});

describe('SLA engine', () => {
  it('uses defaults when no policy is set, and a policy when present', async () => {
    const def = await withTenant(tenant, (c) => resolveSla(c, tenant, 'critical'));
    expect(def.fixMins).toBe(120); // default critical
    await withTenant(tenant, (c) => setSlaPolicy(c, tenant, { name: 'Crit', priority: 'critical', responseMins: 10, fixMins: 60 }));
    const pol = await withTenant(tenant, (c) => resolveSla(c, tenant, 'critical'));
    expect(pol.fixMins).toBe(60);
  });

  it('computes SLA state', () => {
    const now = new Date('2026-07-01T12:00:00Z');
    // opened 11:00, due 13:00, now 12:00 → 50% elapsed → on_track
    expect(slaState({ openedAt: '2026-07-01T11:00:00Z', slaDue: '2026-07-01T13:00:00Z', closedAt: null }, now)).toBe('on_track');
    // opened 10:00, due 12:30, now 12:00 → 80% elapsed → at_risk
    expect(slaState({ openedAt: '2026-07-01T10:00:00Z', slaDue: '2026-07-01T12:30:00Z', closedAt: null }, now)).toBe('at_risk');
    // past due, still open → breached
    expect(slaState({ openedAt: '2026-07-01T08:00:00Z', slaDue: '2026-07-01T11:00:00Z', closedAt: null }, now)).toBe('breached');
    // closed before due → met
    expect(slaState({ openedAt: '2026-07-01T08:00:00Z', slaDue: '2026-07-01T13:00:00Z', closedAt: '2026-07-01T12:30:00Z' }, now)).toBe('met');
  });
});

describe('helpdesk intake → conversion', () => {
  it('intake auto-triages priority and category', async () => {
    const r = await withTenant(tenant, (c) => createRequest(c, tenant, { description: 'Water leak above the print room', spaceId }));
    expect(r.category).toBe('water');
    expect(r.priority).toBe('high');
    expect(r.status).toBe('triaged');
  });

  it('converts a request to a work order with the SLA due date applied', async () => {
    const r = await withTenant(tenant, (c) => createRequest(c, tenant, { description: 'Smoke alarm sounding in Gallery 3', spaceId }));
    const conv = await withTenant(tenant, (c) => convertRequest(c, tenant, r.id));
    expect(conv.ref).toMatch(/^WO-\d{4}-\d{5}$/);
    expect(conv.slaDue).toBeTruthy();
    const wo = await withTenant(tenant, (c) => c.query<{ source: string; sla_due: string | null; priority: string }>(`SELECT source, sla_due, priority FROM wo_work_order WHERE id = $1`, [conv.workOrderId]));
    expect(wo.rows[0].source).toBe('reactive');
    expect(wo.rows[0].priority).toBe('critical'); // fire → critical
    expect(wo.rows[0].sla_due).not.toBeNull();
    const req = await withTenant(tenant, (c) => c.query<{ status: string }>(`SELECT status FROM req_request WHERE id = $1`, [r.id]));
    expect(req.rows[0].status).toBe('converted');
  });
});

describe('contractor scorecard', () => {
  it('computes on-time % and open breaches', async () => {
    const { contractorId } = await withTenant(tenant, async (c) => {
      const cid = (await c.query<{ id: string }>(`INSERT INTO wo_contractor (tenant_id, name) VALUES ($1, 'Mercury HVAC') RETURNING id`, [tenant])).rows[0].id;
      // one closed on-time, one closed late, one open + breached
      await c.query(`INSERT INTO wo_work_order (tenant_id, ref, source, title, status, contractor_id, sla_due, closed_at) VALUES ($1,$2,'reactive','t','closed',$3, now()+interval '1 day', now())`, [tenant, `WO-${Math.random().toString(36).slice(2, 8)}`, cid]);
      await c.query(`INSERT INTO wo_work_order (tenant_id, ref, source, title, status, contractor_id, sla_due, closed_at) VALUES ($1,$2,'reactive','t','closed',$3, now()-interval '1 day', now())`, [tenant, `WO-${Math.random().toString(36).slice(2, 8)}`, cid]);
      await c.query(`INSERT INTO wo_work_order (tenant_id, ref, source, title, status, contractor_id, sla_due) VALUES ($1,$2,'reactive','t','assigned',$3, now()-interval '2 hours')`, [tenant, `WO-${Math.random().toString(36).slice(2, 8)}`, cid]);
      return { contractorId: cid };
    });
    const card = await withTenant(tenant, (c) => contractorScorecard(c, tenant, contractorId));
    expect(card.jobs).toBe(3);
    expect(card.closed).toBe(2);
    expect(card.onTimePct).toBe(50); // 1 of 2 closed on time
    expect(card.openBreaches).toBe(1);
  });
});
