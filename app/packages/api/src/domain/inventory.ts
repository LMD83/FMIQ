import type { PoolClient } from 'pg';

/**
 * Spare parts / stores / inventory (S10). Reserve-against-WO, issue/consume with a
 * cost ledger, and auto-reorder (raises an inv_requisition) when stock hits its
 * minimum. See docs/FMIQ-master-build-plan.md §4.3.
 */

export interface ReserveResult {
  reserved: boolean;
  available: number;
  requisitionId?: string; // raised when stock is short
}

interface StockRow {
  id: string;
  qty_on_hand: number;
  qty_reserved: number;
  min_qty: number;
}

async function loadStock(client: PoolClient, stockId: string): Promise<StockRow | null> {
  const { rows } = await client.query<StockRow>(
    `SELECT id, qty_on_hand::float8 AS qty_on_hand, qty_reserved::float8 AS qty_reserved, min_qty::float8 AS min_qty
       FROM inv_stock WHERE id = $1 FOR UPDATE`,
    [stockId],
  );
  return rows[0] ?? null;
}

/** Raise a reorder requisition if not already open for this part. */
async function ensureReorder(client: PoolClient, tenantId: string, partId: string, qty: number): Promise<string | undefined> {
  const { rows: open } = await client.query<{ id: string }>(
    `SELECT id FROM inv_requisition WHERE part_id = $1 AND status = 'open' LIMIT 1`,
    [partId],
  );
  if (open[0]) return open[0].id;
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO inv_requisition (tenant_id, part_id, qty) VALUES ($1,$2,$3) RETURNING id`,
    [tenantId, partId, qty],
  );
  return rows[0].id;
}

/**
 * Reserve `qty` of a stock line for a work order. If free stock (on_hand − reserved)
 * is insufficient, raise a reorder requisition and report the shortfall.
 */
export async function reserveForWorkOrder(
  client: PoolClient,
  tenantId: string,
  input: { stockId: string; partId: string; qty: number; workOrderId?: string },
): Promise<ReserveResult> {
  const stock = await loadStock(client, input.stockId);
  if (!stock) throw new Error('stock line not found');
  const available = stock.qty_on_hand - stock.qty_reserved;
  if (available >= input.qty) {
    await client.query(`UPDATE inv_stock SET qty_reserved = qty_reserved + $2 WHERE id = $1`, [input.stockId, input.qty]);
    return { reserved: true, available };
  }
  const requisitionId = await ensureReorder(client, tenantId, input.partId, input.qty - available);
  return { reserved: false, available, requisitionId };
}

/**
 * Issue (consume) `qty` against a work order: decrement on-hand (and release the same
 * from reserved), post a cost movement, then auto-reorder if at/below minimum.
 */
export async function issueToWorkOrder(
  client: PoolClient,
  tenantId: string,
  input: { stockId: string; partId: string; qty: number; workOrderId?: string; unitCost?: number },
): Promise<{ onHand: number; reorderRaised: boolean }> {
  const stock = await loadStock(client, input.stockId);
  if (!stock) throw new Error('stock line not found');
  const newOnHand = stock.qty_on_hand - input.qty;
  const newReserved = Math.max(0, stock.qty_reserved - input.qty);
  await client.query(`UPDATE inv_stock SET qty_on_hand = $2, qty_reserved = $3 WHERE id = $1`, [input.stockId, newOnHand, newReserved]);
  await client.query(
    `INSERT INTO inv_movement (tenant_id, part_id, movement_type, work_order_id, qty, unit_cost) VALUES ($1,$2,'issue',$3,$4,$5)`,
    [tenantId, input.partId, input.workOrderId ?? null, input.qty, input.unitCost ?? null],
  );
  let reorderRaised = false;
  if (newOnHand <= stock.min_qty) {
    await ensureReorder(client, tenantId, input.partId, stock.min_qty - newOnHand + 1);
    reorderRaised = true;
  }
  return { onHand: newOnHand, reorderRaised };
}

export async function receiveStock(
  client: PoolClient,
  tenantId: string,
  input: { stockId: string; partId: string; qty: number; unitCost?: number },
): Promise<void> {
  await client.query(`UPDATE inv_stock SET qty_on_hand = qty_on_hand + $2 WHERE id = $1`, [input.stockId, input.qty]);
  await client.query(
    `INSERT INTO inv_movement (tenant_id, part_id, movement_type, qty, unit_cost) VALUES ($1,$2,'receipt',$3,$4)`,
    [tenantId, input.partId, input.qty, input.unitCost ?? null],
  );
}
