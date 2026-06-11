// S10 — spare parts: reserve-against-WO, issue/consume, auto-reorder.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pool } from '../src/db/pool.js';
import { withTenant } from '../src/db/withTenant.js';
import { createTenant } from './helpers/db.js';
import { issueToWorkOrder, receiveStock, reserveForWorkOrder } from '../src/domain/inventory.js';

let tenant: string;

beforeAll(async () => {
  tenant = await createTenant('inv');
});

afterAll(async () => {
  await pool.end();
});

async function makePartStock(onHand: number, minQty: number): Promise<{ partId: string; stockId: string }> {
  return withTenant(tenant, async (c) => {
    const partId = (await c.query<{ id: string }>(`INSERT INTO inv_part (tenant_id, code, name) VALUES ($1, $2, 'Filter') RETURNING id`, [tenant, `P-${Math.random().toString(36).slice(2, 7)}`])).rows[0].id;
    const stockId = (await c.query<{ id: string }>(`INSERT INTO inv_stock (tenant_id, part_id, qty_on_hand, min_qty) VALUES ($1,$2,$3,$4) RETURNING id`, [tenant, partId, onHand, minQty])).rows[0].id;
    return { partId, stockId };
  });
}

describe('inventory', () => {
  it('reserves against a WO when free stock is available', async () => {
    const { partId, stockId } = await makePartStock(10, 2);
    const r = await withTenant(tenant, (c) => reserveForWorkOrder(c, tenant, { stockId, partId, qty: 3 }));
    expect(r.reserved).toBe(true);
    const stock = await withTenant(tenant, (c) => c.query<{ qty_reserved: number }>(`SELECT qty_reserved::float8 FROM inv_stock WHERE id = $1`, [stockId]));
    expect(stock.rows[0].qty_reserved).toBe(3);
  });

  it('raises a reorder requisition when stock is short', async () => {
    const { partId, stockId } = await makePartStock(2, 1);
    const r = await withTenant(tenant, (c) => reserveForWorkOrder(c, tenant, { stockId, partId, qty: 5 }));
    expect(r.reserved).toBe(false);
    expect(r.requisitionId).toBeDefined();
    const req = await withTenant(tenant, (c) => c.query<{ n: number }>(`SELECT count(*)::int AS n FROM inv_requisition WHERE part_id = $1 AND status = 'open'`, [partId]));
    expect(req.rows[0].n).toBe(1);
  });

  it('issuing decrements on-hand, posts a cost movement and auto-reorders at min', async () => {
    const { partId, stockId } = await makePartStock(3, 2);
    const res = await withTenant(tenant, (c) => issueToWorkOrder(c, tenant, { stockId, partId, qty: 2, unitCost: 9.5 }));
    expect(res.onHand).toBe(1);
    expect(res.reorderRaised).toBe(true); // 1 <= min 2
    const mv = await withTenant(tenant, (c) => c.query<{ n: number }>(`SELECT count(*)::int AS n FROM inv_movement WHERE part_id = $1 AND movement_type = 'issue'`, [partId]));
    expect(mv.rows[0].n).toBe(1);
  });

  it('receiving stock increases on-hand and posts a receipt', async () => {
    const { partId, stockId } = await makePartStock(0, 1);
    await withTenant(tenant, (c) => receiveStock(c, tenant, { stockId, partId, qty: 8, unitCost: 4 }));
    const stock = await withTenant(tenant, (c) => c.query<{ qty_on_hand: number }>(`SELECT qty_on_hand::float8 FROM inv_stock WHERE id = $1`, [stockId]));
    expect(stock.rows[0].qty_on_hand).toBe(8);
  });
});
