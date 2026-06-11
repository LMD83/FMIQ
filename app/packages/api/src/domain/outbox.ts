import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { pool } from '../db/pool.js';

/**
 * The transactional outbox — the eventing backbone primitive.
 *
 * `emitEvent` writes a CloudEvents 1.0 envelope to `evt_outbox` INSIDE the caller's
 * tenant transaction, so a domain change and its event commit (or roll back) atomically.
 * `idempotency_key` + `ON CONFLICT DO NOTHING` makes re-emits no-ops.
 *
 * `relayBatch` is the worker's unit of work: claim a batch of pending rows with
 * `FOR UPDATE SKIP LOCKED`, publish each via a `Transport`, mark processed or
 * back off with bounded retries. It MUST run under `withOutboxWorker` (which sets
 * the worker GUC so RLS lets the relay see every tenant's rows).
 *
 * See docs/adr-003-eventing-outbox.md and docs/FMIQ-master-build-plan.md §3.1.
 */

/** CloudEvents 1.0 envelope (https://cloudevents.io). Stored as `evt_outbox.payload`. */
export interface CloudEvent {
  specversion: '1.0';
  id: string;
  source: string;
  type: string;
  subject?: string;
  time: string;
  datacontenttype: 'application/json';
  data: unknown;
}

export interface EmitOptions {
  tenantId: string;
  /** Event type, e.g. 'fmiq.excursion.opened'. */
  type: string;
  data: unknown;
  /** Optional subject (e.g. the entity id the event is about). */
  subject?: string;
  /** Dedup key. Provide a stable one (e.g. `excursion.opened:<id>`) for meaningful dedup. */
  idempotencyKey?: string;
}

export interface EmitResult {
  /** false when an event with the same idempotency key already existed (no-op). */
  emitted: boolean;
  id: string;
  idempotencyKey: string;
}

/**
 * Enqueue a domain event. Call with the SAME client as the domain write (inside
 * `withTenant`) so the event is atomic with it.
 */
export async function emitEvent(client: PoolClient, opts: EmitOptions): Promise<EmitResult> {
  const id = randomUUID();
  const idempotencyKey = opts.idempotencyKey ?? id;
  const envelope: CloudEvent = {
    specversion: '1.0',
    id,
    source: `urn:fmiq:tenant:${opts.tenantId}`,
    type: opts.type,
    subject: opts.subject,
    time: new Date().toISOString(),
    datacontenttype: 'application/json',
    data: opts.data,
  };
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO evt_outbox (tenant_id, event_type, payload, idempotency_key)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (idempotency_key) DO NOTHING
     RETURNING id`,
    [opts.tenantId, opts.type, JSON.stringify(envelope), idempotencyKey],
  );
  const emitted = rows.length > 0;
  return { emitted, id: emitted ? rows[0].id : id, idempotencyKey };
}

// ---------------------------------------------------------------------------
// Relay
// ---------------------------------------------------------------------------

export interface OutboxMessage {
  id: string;
  tenant_id: string;
  event_type: string;
  payload: CloudEvent;
  idempotency_key: string;
  attempts: number;
}

/** A publish target. Production: Azure Service Bus. MVP/tests: log / collecting. */
export interface Transport {
  name: string;
  publish(message: OutboxMessage): Promise<void>;
}

export const MAX_ATTEMPTS = 5;

/** Exponential backoff, capped at 60s: 2s, 4s, 8s, 16s, 32s. */
export function backoffMs(attempts: number): number {
  return Math.min(60_000, 1_000 * 2 ** attempts);
}

/**
 * Run `fn` in a transaction with the worker GUC set, so RLS lets the relay read
 * and update every tenant's outbox rows. **Only the relay may use this** — never
 * the request path. SET LOCAL is transaction-scoped, so it's pool-safe.
 */
export async function withOutboxWorker<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT set_config($1, $2, true)', ['app.worker_mode', 'on']);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export interface RelayResult {
  processed: number;
  failed: number;
}

/**
 * Claim and dispatch up to `limit` pending events. Rows are locked FOR UPDATE
 * SKIP LOCKED for the life of the transaction, so concurrent relays never double
 * process. Must be called inside `withOutboxWorker`.
 */
export async function relayBatch(
  client: PoolClient,
  transport: Transport,
  limit = 20,
): Promise<RelayResult> {
  const { rows } = await client.query<OutboxMessage>(
    `SELECT id, tenant_id, event_type, payload, idempotency_key, attempts
       FROM evt_outbox
      WHERE processed_at IS NULL AND failed_at IS NULL AND available_at <= now()
      ORDER BY created_at
      FOR UPDATE SKIP LOCKED
      LIMIT $1`,
    [limit],
  );

  let processed = 0;
  let failed = 0;
  for (const message of rows) {
    try {
      await transport.publish(message);
      await client.query(
        `UPDATE evt_outbox SET processed_at = now(), attempts = attempts + 1, last_error = NULL WHERE id = $1`,
        [message.id],
      );
      processed++;
    } catch (err) {
      const attempts = message.attempts + 1;
      const dead = attempts >= MAX_ATTEMPTS;
      await client.query(
        `UPDATE evt_outbox
            SET attempts = $2,
                last_error = $3,
                available_at = now() + ($4 || ' milliseconds')::interval,
                failed_at = $5
          WHERE id = $1`,
        [message.id, attempts, String((err as Error).message).slice(0, 500), backoffMs(attempts), dead ? new Date().toISOString() : null],
      );
      failed++;
    }
  }
  return { processed, failed };
}
