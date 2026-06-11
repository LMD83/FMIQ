// GOV-69 — RLS isolation test harness.
//
// The single highest-value test in this codebase: it proves that Row-Level Security
// physically isolates tenants on EVERY tenant-scoped table. Insert as tenant A,
// query as tenant B, assert zero rows. If a future migration adds a tenant table
// without the RLS treatment, add it to RLS_TABLES and this suite fails until the
// policy is in place. See app/CODEBASE.md §6 and docs/PROJECT-PLAN.md §5 (S1-1).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pool } from '../src/db/pool.js';
import { withTenant } from '../src/db/withTenant.js';
import { createTenant, seedOneRowPerTable, visibleCount, RLS_TABLES, type SeededRow } from './helpers/db.js';

let tenantA: string;
let tenantB: string;
let seededA: SeededRow[];

beforeAll(async () => {
  tenantA = await createTenant('tenant-a');
  tenantB = await createTenant('tenant-b');
  seededA = await seedOneRowPerTable(tenantA);
  await seedOneRowPerTable(tenantB);
});

afterAll(async () => {
  await pool.end();
});

describe('RLS tenant isolation', () => {
  it('seeds one row into every RLS-protected table', () => {
    const seeded = new Set(seededA.map((r) => r.table));
    for (const table of RLS_TABLES) {
      expect(seeded.has(table), `no seed row for ${table} — extend seedOneRowPerTable`).toBe(true);
    }
    expect(seededA).toHaveLength(RLS_TABLES.length);
  });

  // One assertion per table: tenant A sees its row; tenant B sees zero of it.
  for (const table of RLS_TABLES) {
    it(`${table}: tenant B sees zero of tenant A's row`, async () => {
      const a = seededA.find((r) => r.table === table);
      expect(a, `missing seed for ${table}`).toBeDefined();
      expect(await visibleCount(tenantA, table, a!.where, a!.params)).toBe(1);
      expect(await visibleCount(tenantB, table, a!.where, a!.params)).toBe(0);
    });
  }

  it('WITH CHECK blocks inserting a row tagged with another tenant', async () => {
    await expect(
      withTenant(tenantB, (c) => c.query(`INSERT INTO est_site (tenant_id, name) VALUES ($1, 'X')`, [tenantA])),
    ).rejects.toThrow();
  });

  it('a tenant cannot UPDATE another tenant out of its own rows (WITH CHECK)', async () => {
    const site = seededA.find((r) => r.table === 'est_site')!;
    // tenant A owns the row; trying to reassign it to tenant B must affect zero rows
    // (the row leaves A's visibility) or be rejected — either way A keeps nothing reassigned.
    const moved = await withTenant(tenantA, async (c) => {
      try {
        const res = await c.query(`UPDATE est_site SET tenant_id = $1 WHERE ${site.where}`, [tenantB, ...site.params]);
        return res.rowCount ?? 0;
      } catch {
        return -1; // rejected by WITH CHECK
      }
    });
    expect(moved).toBeLessThanOrEqual(0);
    // and tenant B never gains the row
    expect(await visibleCount(tenantB, 'est_site', site.where, site.params)).toBe(0);
  });
});
