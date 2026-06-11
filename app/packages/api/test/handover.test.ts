// P2 — Handover Gate + COBie import (capital → operations golden thread).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pool } from '../src/db/pool.js';
import { withTenant } from '../src/db/withTenant.js';
import { createTenant } from './helpers/db.js';
import { addCert, createHandover, goLive, handoverGateStatus, importCobie, HandoverError } from '../src/domain/handover.js';
import { parseCobie } from '../src/adapters/cobie.js';

let tenant: string;
let buildingId: string;

beforeAll(async () => {
  tenant = await createTenant('hov');
  await withTenant(tenant, async (c) => {
    const site = (await c.query<{ id: string }>(`INSERT INTO est_site (tenant_id, name) VALUES ($1,'S') RETURNING id`, [tenant])).rows[0].id;
    buildingId = (await c.query<{ id: string }>(`INSERT INTO est_building (tenant_id, site_id, name) VALUES ($1,$2,'B') RETURNING id`, [tenant, site])).rows[0].id;
  });
});

afterAll(async () => {
  await pool.end();
});

const COBIE = {
  Component: [
    { Name: 'AHU-1', Type: 'Fire alarm panel', Manufacturer: 'Hochiki', InstallationDate: '2026-06-01', WarrantyDurationParts: 24 },
    { Name: 'Lift-A', Type: 'Lift', Manufacturer: 'KONE', InstallationDate: '2026-06-01' },
  ],
  Space: [{ Name: 'Plant Room' }],
  Spare: [{ Name: 'Filter G4', PartNumber: 'F-G4', Manufacturer: 'Camfil' }],
};

describe('COBie parser', () => {
  it('validates and flattens required sheets', () => {
    const p = parseCobie(COBIE);
    expect(p.components).toHaveLength(2);
    expect(p.spares).toHaveLength(1);
  });
  it('rejects an empty Component sheet', () => {
    expect(() => parseCobie({ Component: [] })).toThrow();
  });
});

describe('Handover Gate', () => {
  it('blocks go-live until the cert chain validates and COBie imports', async () => {
    const ho = await withTenant(tenant, (c) => createHandover(c, tenant, { buildingId }));

    let gate = await withTenant(tenant, (c) => handoverGateStatus(c, tenant, ho.id));
    expect(gate.goLiveBlocked).toBe(true);
    expect(gate.missing).toEqual(expect.arrayContaining(['ccc', 'fsc', 'dac', 'safety_file', 'cobie_import']));

    // CCC without a BCMS ref does not satisfy the gate.
    await withTenant(tenant, (c) => addCert(c, tenant, { handoverId: ho.id, certType: 'ccc', validated: true }));
    gate = await withTenant(tenant, (c) => handoverGateStatus(c, tenant, ho.id));
    expect(gate.missing).toContain('ccc');

    // Provide the full validated chain.
    await withTenant(tenant, async (c) => {
      await addCert(c, tenant, { handoverId: ho.id, certType: 'ccc', reference: 'CCC-1', bcmsRef: 'BCMS-1', validated: true });
      await addCert(c, tenant, { handoverId: ho.id, certType: 'fsc', validated: true });
      await addCert(c, tenant, { handoverId: ho.id, certType: 'dac', validated: true });
      await addCert(c, tenant, { handoverId: ho.id, certType: 'safety_file', validated: true });
    });

    // Still blocked on COBie.
    gate = await withTenant(tenant, (c) => handoverGateStatus(c, tenant, ho.id));
    expect(gate.missing).toEqual(['cobie_import']);
    await expect(withTenant(tenant, (c) => goLive(c, tenant, ho.id))).rejects.toBeInstanceOf(HandoverError);

    // Import COBie → assets + PPM schedules + warranties + spares created.
    const result = await withTenant(tenant, (c) => importCobie(c, tenant, ho.id, parseCobie(COBIE)));
    expect(result.components).toBe(2);
    expect(result.schedules).toBeGreaterThanOrEqual(1); // fire panel + lift match templates
    expect(result.warranties).toBe(1); // AHU-1 had a warranty duration
    expect(result.spares).toBe(1);

    // Gate now green → go-live succeeds.
    gate = await withTenant(tenant, (c) => handoverGateStatus(c, tenant, ho.id));
    expect(gate.goLiveBlocked).toBe(false);
    const live = await withTenant(tenant, (c) => goLive(c, tenant, ho.id));
    expect(live.goLiveBlocked).toBe(false);

    const status = await withTenant(tenant, (c) => c.query<{ status: string }>(`SELECT status FROM hov_handover WHERE id = $1`, [ho.id]));
    expect(status.rows[0].status).toBe('live');

    // Auto-populated assets are now in the register.
    const assets = await withTenant(tenant, (c) => c.query<{ n: number }>(`SELECT count(*)::int AS n FROM est_asset WHERE asset_type = 'Lift'`));
    expect(assets.rows[0].n).toBeGreaterThanOrEqual(1);
  });
});
