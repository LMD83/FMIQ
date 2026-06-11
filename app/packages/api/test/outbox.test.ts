// GOV-72 / GOV-73 — transactional outbox + relay worker.
// Covers: atomic emit, idempotency (ON CONFLICT DO NOTHING), CloudEvents envelope,
// relay drain (at-least-once), bounded retry + backoff, dead-lettering, FOR UPDATE
// SKIP LOCKED (no double-processing), cross-tenant worker drain, and the end-to-end
// excursion → outbox emit from the collection-care hero loop.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { pool } from '../src/db/pool.js';
import { withTenant } from '../src/db/withTenant.js';
import { createTenant } from './helpers/db.js';
import {
  emitEvent,
  relayBatch,
  withOutboxWorker,
  MAX_ATTEMPTS,
  backoffMs,
  type OutboxMessage,
  type Transport,
} from '../src/domain/outbox.js';
import { evaluateReading } from '../src/domain/collectionCare.js';

class CollectingTransport implements Transport {
  name = 'collect';
  events: OutboxMessage[] = [];
  async publish(message: OutboxMessage): Promise<void> {
    this.events.push(message);
  }
}

class FailingTransport implements Transport {
  name = 'fail';
  async publish(): Promise<void> {
    throw new Error('boom');
  }
}

/** Mark every pending row processed so a relay test starts from a clean slate. */
async function clearPending(): Promise<void> {
  await withOutboxWorker((c) =>
    c.query(`UPDATE evt_outbox SET processed_at = now() WHERE processed_at IS NULL AND failed_at IS NULL`),
  );
}

afterAll(async () => {
  await pool.end();
});

describe('outbox — emitEvent', () => {
  it('enqueues a CloudEvents 1.0 envelope inside the tenant transaction', async () => {
    const tenant = await createTenant('emit');
    const key = `k-${randomUUID()}`;
    const res = await withTenant(tenant, (c) =>
      emitEvent(c, { tenantId: tenant, type: 'fmiq.test.happened', subject: 'subj-1', data: { a: 1 }, idempotencyKey: key }),
    );
    expect(res.emitted).toBe(true);

    const row = await withTenant(tenant, (c) =>
      c.query<{ event_type: string; payload: any }>(`SELECT event_type, payload FROM evt_outbox WHERE idempotency_key = $1`, [key]),
    );
    expect(row.rows[0].event_type).toBe('fmiq.test.happened');
    expect(row.rows[0].payload.specversion).toBe('1.0');
    expect(row.rows[0].payload.type).toBe('fmiq.test.happened');
    expect(row.rows[0].payload.subject).toBe('subj-1');
    expect(row.rows[0].payload.data).toEqual({ a: 1 });
  });

  it('is idempotent — a repeated key is a no-op', async () => {
    const tenant = await createTenant('emit-idem');
    const key = `k-${randomUUID()}`;
    const first = await withTenant(tenant, (c) => emitEvent(c, { tenantId: tenant, type: 't', data: {}, idempotencyKey: key }));
    const second = await withTenant(tenant, (c) => emitEvent(c, { tenantId: tenant, type: 't', data: {}, idempotencyKey: key }));
    expect(first.emitted).toBe(true);
    expect(second.emitted).toBe(false);
    const count = await withTenant(tenant, (c) => c.query<{ n: number }>(`SELECT count(*)::int AS n FROM evt_outbox WHERE idempotency_key = $1`, [key]));
    expect(count.rows[0].n).toBe(1);
  });

  it('rolls back with its transaction (atomic with the domain write)', async () => {
    const tenant = await createTenant('emit-atomic');
    const key = `k-${randomUUID()}`;
    await expect(
      withTenant(tenant, async (c) => {
        await emitEvent(c, { tenantId: tenant, type: 't', data: {}, idempotencyKey: key });
        throw new Error('force rollback');
      }),
    ).rejects.toThrow('force rollback');
    const count = await withTenant(tenant, (c) => c.query<{ n: number }>(`SELECT count(*)::int AS n FROM evt_outbox WHERE idempotency_key = $1`, [key]));
    expect(count.rows[0].n).toBe(0);
  });
});

describe('outbox — relay', () => {
  beforeEach(clearPending);

  it('drains pending events and marks them processed', async () => {
    const tenant = await createTenant('relay-drain');
    for (let i = 0; i < 3; i++) {
      await withTenant(tenant, (c) => emitEvent(c, { tenantId: tenant, type: 'fmiq.test', data: { i }, idempotencyKey: `d-${randomUUID()}` }));
    }
    const transport = new CollectingTransport();
    const res = await withOutboxWorker((c) => relayBatch(c, transport));
    expect(res.processed).toBe(3);
    expect(res.failed).toBe(0);
    expect(transport.events).toHaveLength(3);
    const pending = await withOutboxWorker((c) => c.query<{ n: number }>(`SELECT count(*)::int AS n FROM evt_outbox WHERE processed_at IS NULL`));
    expect(pending.rows[0].n).toBe(0);
  });

  it('retries with backoff on dispatch failure (bounded, not yet dead)', async () => {
    const tenant = await createTenant('relay-retry');
    await withTenant(tenant, (c) => emitEvent(c, { tenantId: tenant, type: 't', data: {}, idempotencyKey: `r-${randomUUID()}` }));
    const res = await withOutboxWorker((c) => relayBatch(c, new FailingTransport()));
    expect(res.failed).toBe(1);
    const row = await withOutboxWorker((c) =>
      c.query<{ attempts: number; processed_at: string | null; failed_at: string | null; last_error: string | null; due: boolean }>(
        `SELECT attempts, processed_at, failed_at, last_error, available_at <= now() AS due FROM evt_outbox WHERE processed_at IS NULL`,
      ),
    );
    expect(row.rows[0].attempts).toBe(1);
    expect(row.rows[0].processed_at).toBeNull();
    expect(row.rows[0].failed_at).toBeNull();
    expect(row.rows[0].last_error).toContain('boom');
    expect(row.rows[0].due).toBe(false); // backed off into the future

    // Immediate re-run picks nothing up (not yet due).
    const again = await withOutboxWorker((c) => relayBatch(c, new CollectingTransport()));
    expect(again.processed).toBe(0);
  });

  it('dead-letters after MAX_ATTEMPTS', async () => {
    const tenant = await createTenant('relay-dead');
    await withTenant(tenant, (c) => emitEvent(c, { tenantId: tenant, type: 't', data: {}, idempotencyKey: `x-${randomUUID()}` }));
    // Pretend it has already failed MAX-1 times and is due now.
    await withOutboxWorker((c) =>
      c.query(`UPDATE evt_outbox SET attempts = $1, available_at = now() WHERE processed_at IS NULL`, [MAX_ATTEMPTS - 1]),
    );
    const res = await withOutboxWorker((c) => relayBatch(c, new FailingTransport()));
    expect(res.failed).toBe(1);
    const row = await withOutboxWorker((c) =>
      c.query<{ attempts: number; failed_at: string | null }>(`SELECT attempts, failed_at FROM evt_outbox WHERE attempts = $1`, [MAX_ATTEMPTS]),
    );
    expect(row.rows[0].attempts).toBe(MAX_ATTEMPTS);
    expect(row.rows[0].failed_at).not.toBeNull();
  });

  it('does not double-process under concurrent relays (FOR UPDATE SKIP LOCKED)', async () => {
    const tenant = await createTenant('relay-skiplock');
    for (let i = 0; i < 4; i++) {
      await withTenant(tenant, (c) => emitEvent(c, { tenantId: tenant, type: 't', data: { i }, idempotencyKey: `s-${randomUUID()}` }));
    }
    // Worker 1 claims and holds all rows in an open transaction.
    const blocker = await pool.connect();
    await blocker.query('BEGIN');
    await blocker.query('SELECT set_config($1, $2, true)', ['app.worker_mode', 'on']);
    const locked = await blocker.query(
      `SELECT id FROM evt_outbox WHERE processed_at IS NULL AND failed_at IS NULL AND available_at <= now() FOR UPDATE SKIP LOCKED`,
    );
    expect(locked.rowCount).toBe(4);

    // Worker 2 runs concurrently — every row is locked, so it processes none.
    const concurrent = await withOutboxWorker((c) => relayBatch(c, new CollectingTransport()));
    expect(concurrent.processed).toBe(0);

    await blocker.query('ROLLBACK');
    blocker.release();

    // With the lock released, a relay drains all four.
    const after = await withOutboxWorker((c) => relayBatch(c, new CollectingTransport()));
    expect(after.processed).toBe(4);
  });

  it('drains across tenants in worker mode', async () => {
    const tenantA = await createTenant('relay-xt-a');
    const tenantB = await createTenant('relay-xt-b');
    await withTenant(tenantA, (c) => emitEvent(c, { tenantId: tenantA, type: 't', data: {}, idempotencyKey: `a-${randomUUID()}` }));
    await withTenant(tenantB, (c) => emitEvent(c, { tenantId: tenantB, type: 't', data: {}, idempotencyKey: `b-${randomUUID()}` }));
    const transport = new CollectingTransport();
    const res = await withOutboxWorker((c) => relayBatch(c, transport));
    expect(res.processed).toBe(2);
    const tenants = new Set(transport.events.map((e) => e.tenant_id));
    expect(tenants.has(tenantA)).toBe(true);
    expect(tenants.has(tenantB)).toBe(true);
  });

  it('backoffMs grows exponentially and caps at 60s', () => {
    expect(backoffMs(1)).toBe(2_000);
    expect(backoffMs(2)).toBe(4_000);
    expect(backoffMs(100)).toBe(60_000);
  });
});

describe('outbox — collection-care integration', () => {
  it('emits fmiq.excursion.opened atomically when an excursion is raised', async () => {
    const tenant = await createTenant('cc-emit');
    let sensorId = '';
    let zoneId = '';
    await withTenant(tenant, async (c) => {
      const site = (await c.query<{ id: string }>(`INSERT INTO est_site (tenant_id, name) VALUES ($1, 'S') RETURNING id`, [tenant])).rows[0].id;
      const b = (await c.query<{ id: string }>(`INSERT INTO est_building (tenant_id, site_id, name) VALUES ($1, $2, 'B') RETURNING id`, [tenant, site])).rows[0].id;
      const f = (await c.query<{ id: string }>(`INSERT INTO est_floor (tenant_id, building_id, name) VALUES ($1, $2, 'F') RETURNING id`, [tenant, b])).rows[0].id;
      const sp = (await c.query<{ id: string }>(`INSERT INTO est_space (tenant_id, floor_id, name, space_type, is_collection_zone) VALUES ($1, $2, 'G', 'gallery', true) RETURNING id`, [tenant, f])).rows[0].id;
      zoneId = (await c.query<{ id: string }>(`INSERT INTO cc_zone (tenant_id, space_id, name) VALUES ($1, $2, 'Zone') RETURNING id`, [tenant, sp])).rows[0].id;
      const std = (await c.query<{ id: string }>(`SELECT id FROM cc_standard WHERE code = 'ASHRAE_A'`)).rows[0].id;
      await c.query(
        `INSERT INTO cc_zone_target (tenant_id, cc_zone_id, cc_standard_id, rh_min, rh_max, rh_rate_max_per_24h) VALUES ($1, $2, $3, 45, 55, 5)`,
        [tenant, zoneId, std],
      );
      sensorId = (await c.query<{ id: string }>(`INSERT INTO cc_sensor (tenant_id, cc_zone_id, vendor, external_id, metrics) VALUES ($1, $2, 'conserv', 'X', '{rh}') RETURNING id`, [tenant, zoneId])).rows[0].id;
    });

    const res = await withTenant(tenant, (c) => evaluateReading(c, tenant, { sensorId, zoneId, metric: 'rh', value: 70 }));
    expect(res.breach).toBe(true);
    expect(res.excursionId).toBeDefined();

    const ev = await withTenant(tenant, (c) =>
      c.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM evt_outbox WHERE event_type = 'fmiq.excursion.opened' AND idempotency_key = $1`,
        [`excursion.opened:${res.excursionId}`],
      ),
    );
    expect(ev.rows[0].n).toBe(1);
  });
});
