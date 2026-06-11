// S5–S6 — PPM scheduler: compliance clock, schedule creation (template defaults),
// and auto work-order generation with next_due advance.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pool } from '../src/db/pool.js';
import { withTenant } from '../src/db/withTenant.js';
import { createTenant } from './helpers/db.js';
import { complianceClock, createSchedule, generateDueWorkOrders, proposeTemplates } from '../src/domain/ppm.js';

let tenant: string;
let assetId: string;

beforeAll(async () => {
  tenant = await createTenant('ppm');
  await withTenant(tenant, async (c) => {
    const site = (await c.query<{ id: string }>(`INSERT INTO est_site (tenant_id, name) VALUES ($1,'S') RETURNING id`, [tenant])).rows[0].id;
    const b = (await c.query<{ id: string }>(`INSERT INTO est_building (tenant_id, site_id, name) VALUES ($1,$2,'B') RETURNING id`, [tenant, site])).rows[0].id;
    const f = (await c.query<{ id: string }>(`INSERT INTO est_floor (tenant_id, building_id, name) VALUES ($1,$2,'F') RETURNING id`, [tenant, b])).rows[0].id;
    const sp = (await c.query<{ id: string }>(`INSERT INTO est_space (tenant_id, floor_id, name, space_type) VALUES ($1,$2,'Plant','plant') RETURNING id`, [tenant, f])).rows[0].id;
    assetId = (await c.query<{ id: string }>(`INSERT INTO est_asset (tenant_id, space_id, code, name, asset_type) VALUES ($1,$2,'FP-1','Fire panel','Fire') RETURNING id`, [tenant, sp])).rows[0].id;
  });
});

afterAll(async () => {
  await pool.end();
});

const day = 86_400_000;

describe('compliance clock', () => {
  it('maps elapsed fraction to green/amber/red/breach', () => {
    expect(complianceClock(new Date(Date.now() + 60 * day), 90).status).toBe('green'); // 33% elapsed
    expect(complianceClock(new Date(Date.now() + 12 * day), 90).status).toBe('amber'); // ~87% elapsed
    expect(complianceClock(new Date(Date.now() + 2 * day), 90).status).toBe('red'); // ~98% elapsed
    expect(complianceClock(new Date(Date.now() - day), 90).status).toBe('breach');
  });
});

describe('PPM scheduling', () => {
  it('proposes statutory templates first', async () => {
    const templates = await withTenant(tenant, (c) => proposeTemplates(c, 'Fire'));
    expect(templates.some((t) => t.code === 'FIRE-ALARM-Q')).toBe(true);
  });

  it('creates a schedule inheriting template defaults (classification/statutory/frequency)', async () => {
    const tpl = await withTenant(tenant, (c) => c.query<{ id: string }>(`SELECT id FROM wo_task_template WHERE code='FIRE-ALARM-Q'`));
    const sched = await withTenant(tenant, (c) => createSchedule(c, tenant, { assetId, taskTemplateId: tpl.rows[0].id, nextDue: new Date().toISOString().slice(0, 10) }));
    expect(sched.statutory_flag).toBe(true);
    expect(sched.classification).toBe('red');
    expect(sched.frequency).toBe('3 mons');
  });

  it('generates a work order for a due schedule and advances next_due', async () => {
    const tpl = await withTenant(tenant, (c) => c.query<{ id: string }>(`SELECT id FROM wo_task_template WHERE code='LEGIONELLA-M'`));
    const sched = await withTenant(tenant, (c) => createSchedule(c, tenant, { assetId, taskTemplateId: tpl.rows[0].id, nextDue: new Date().toISOString().slice(0, 10) }));

    const gen = await withTenant(tenant, (c) => generateDueWorkOrders(c, tenant));
    expect(gen.some((g) => g.scheduleId === sched.id)).toBe(true);
    expect(gen.find((g) => g.scheduleId === sched.id)!.ref).toMatch(/^WO-\d{4}-\d{5}$/);

    // next_due advanced by 1 month → no second WO on an immediate re-run.
    const again = await withTenant(tenant, (c) => generateDueWorkOrders(c, tenant));
    expect(again.some((g) => g.scheduleId === sched.id)).toBe(false);

    const wo = await withTenant(tenant, (c) => c.query<{ source: string }>(`SELECT source FROM wo_work_order WHERE id = $1`, [gen.find((g) => g.scheduleId === sched.id)!.workOrderId]));
    expect(wo.rows[0].source).toBe('ppm');
  });
});
