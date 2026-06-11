// EP-INT — integration adapters (parse + ingest): Hanwell/T&D sensors, Revenue eTax,
// fire-alarm + emergency-lighting panels, Axiell CMS sync.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pool } from '../src/db/pool.js';
import { withTenant } from '../src/db/withTenant.js';
import { createTenant } from './helpers/db.js';
import { hanwellAdapter } from '../src/adapters/hanwell.js';
import { tanddAdapter } from '../src/adapters/tandd.js';
import { parseRevenueResponse, revenueTaxClearanceGateway } from '../src/adapters/revenue.js';
import { parseFirePanelEvent } from '../src/adapters/firePanel.js';
import { parseEmergencyLightingTest } from '../src/adapters/emergencyLighting.js';
import { parseAxiellObjects } from '../src/adapters/axiell.js';
import { ingestEmergencyLightingTest, ingestFirePanelEvent } from '../src/domain/lifeSafety.js';
import { syncObjectsForZone } from '../src/domain/cms.js';

describe('sensor adapters', () => {
  it('Hanwell CSV → normalised readings', () => {
    const csv = 'serial,metric,value,unit,timestamp\nHW-1,RH,52.4,%,2026-07-01T10:00:00Z\nHW-1,Temperature,20.1,C,2026-07-01T10:00:00Z\nHW-1,gizmo,9,x,';
    const parsed = hanwellAdapter.parse(csv);
    expect(parsed.externalId).toBe('HW-1');
    expect(parsed.readings.map((r) => r.metric)).toEqual(['rh', 'temp']); // unknown 'gizmo' dropped
  });

  it('T&D JSON → normalised readings', () => {
    const parsed = tanddAdapter.parse({ serial: 'TD-9', readings: [{ type: 't', value: 19.5, unit: 'C' }, { type: 'humidity', value: 48 }] });
    expect(parsed.externalId).toBe('TD-9');
    expect(parsed.readings).toHaveLength(2);
  });
});

describe('Revenue eTax clearance adapter', () => {
  it('maps response statuses', () => {
    expect(parseRevenueResponse('<Result>Valid</Result>')).toBe('valid');
    expect(parseRevenueResponse('<ns:Status>Expired</ns:Status>')).toBe('expired');
    expect(parseRevenueResponse('<Result>Revoked</Result>')).toBe('revoked');
    expect(parseRevenueResponse('garbage')).toBe('unknown');
  });

  it('gateway verifies via an injected fetcher', async () => {
    const gw = revenueTaxClearanceGateway(async () => '<Result>Valid</Result>');
    expect(await gw.verify('TCAN123')).toBe('valid');
    const failing = revenueTaxClearanceGateway(async () => { throw new Error('down'); });
    expect(await failing.verify('TCAN123')).toBe('unknown');
  });
});

describe('life-safety panel parsers', () => {
  it('classifies fire-panel events', () => {
    expect(parseFirePanelEvent({ panel_id: 'FP1', event: 'Zone Fault' }).eventType).toBe('fault');
    expect(parseFirePanelEvent({ panel_id: 'FP1', event: 'Weekly Test' }).eventType).toBe('test');
    expect(parseFirePanelEvent({ panel_id: 'FP1', event: 'Alarm Activation', zone: 'Z3' }).eventType).toBe('activation');
  });

  it('parses an emergency-lighting test', () => {
    const t = parseEmergencyLightingTest({ system_id: 'EL1', test_type: 'annual', luminaires: [{ ref: 'L1', pass: true }, { ref: 'L2', pass: false }] });
    expect(t.testType).toBe('annual');
    expect(t.luminaires).toHaveLength(2);
  });

  it('parses Axiell objects, data-minimised', () => {
    const objs = parseAxiellObjects({ records: [{ object_number: 'DT:1', title: 'Mantua', medium: 'Silk', sensitivity: 'High', location: 'Z-TXG' }] });
    expect(objs[0]).toMatchObject({ cmsObjectRef: 'DT:1', objectName: 'Mantua', sensitivity: 'high', primaryZoneRef: 'Z-TXG' });
  });
});

describe('life-safety + CMS ingest (DB)', () => {
  let tenant: string;
  let spaceId: string;
  let zoneId: string;

  beforeAll(async () => {
    tenant = await createTenant('integ');
    await withTenant(tenant, async (c) => {
      const site = (await c.query<{ id: string }>(`INSERT INTO est_site (tenant_id, name) VALUES ($1,'S') RETURNING id`, [tenant])).rows[0].id;
      const b = (await c.query<{ id: string }>(`INSERT INTO est_building (tenant_id, site_id, name) VALUES ($1,$2,'B') RETURNING id`, [tenant, site])).rows[0].id;
      const f = (await c.query<{ id: string }>(`INSERT INTO est_floor (tenant_id, building_id, name) VALUES ($1,$2,'F') RETURNING id`, [tenant, b])).rows[0].id;
      spaceId = (await c.query<{ id: string }>(`INSERT INTO est_space (tenant_id, floor_id, name, space_type) VALUES ($1,$2,'G','gallery') RETURNING id`, [tenant, f])).rows[0].id;
      zoneId = (await c.query<{ id: string }>(`INSERT INTO cc_zone (tenant_id, space_id, name) VALUES ($1,$2,'Z') RETURNING id`, [tenant, spaceId])).rows[0].id;
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  it('a fire-panel fault auto-raises a work order', async () => {
    const r = await withTenant(tenant, (c) => ingestFirePanelEvent(c, tenant, { externalId: 'FP1', eventType: 'fault', zone: 'Z3' }, spaceId));
    expect(r.workOrderId).toBeDefined();
    const wo = await withTenant(tenant, (c) => c.query<{ source: string }>(`SELECT source FROM wo_work_order WHERE id = $1`, [r.workOrderId]));
    expect(wo.rows[0].source).toBe('reactive');
  });

  it('a fire-panel test event raises no work order', async () => {
    const r = await withTenant(tenant, (c) => ingestFirePanelEvent(c, tenant, { externalId: 'FP1', eventType: 'test' }, spaceId));
    expect(r.workOrderId).toBeUndefined();
  });

  it('a failed emergency-lighting test creates a remedial work order', async () => {
    const r = await withTenant(tenant, (c) =>
      ingestEmergencyLightingTest(c, tenant, { externalId: 'EL1', testType: 'monthly', luminaires: [{ ref: 'L1', pass: true }, { ref: 'L2', pass: false }] }, spaceId),
    );
    expect(r.passed).toBe(false);
    expect(r.remedialWorkOrderId).toBeDefined();
  });

  it('Axiell sync upserts data-minimised object links and is idempotent', async () => {
    const objs = parseAxiellObjects({ records: [
      { object_number: 'O1', title: 'A', medium: 'Silk', sensitivity: 'high', location: 'Z' },
      { object_number: 'O2', title: 'B', sensitivity: 'low', location: 'Z' },
    ] });
    await withTenant(tenant, (c) => syncObjectsForZone(c, tenant, zoneId, 'axiell', objs));
    await withTenant(tenant, (c) => syncObjectsForZone(c, tenant, zoneId, 'axiell', objs)); // re-run
    const n = await withTenant(tenant, (c) => c.query<{ n: number }>(`SELECT count(*)::int AS n FROM cc_object_link WHERE cc_zone_id = $1 AND cms_vendor = 'axiell'`, [zoneId]));
    expect(n.rows[0].n).toBe(2); // not duplicated
  });
});
