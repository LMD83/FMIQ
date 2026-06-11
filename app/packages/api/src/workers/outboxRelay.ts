import { relayBatch, withOutboxWorker, type OutboxMessage, type Transport } from '../domain/outbox.js';

/**
 * Outbox relay worker (skeleton).
 *
 * Polls the transactional outbox and dispatches pending events. The transport is
 * pluggable: this MVP logs (and, later, publishes to Azure Service Bus + ACS email).
 * Started in-process by the API in dev (`npm run dev`); in production it runs as its
 * own Container App. See docs/adr-003-eventing-outbox.md.
 */

/** MVP transport — logs each event. Swap for a Service Bus transport in production. */
export class LogTransport implements Transport {
  name = 'log';
  async publish(message: OutboxMessage): Promise<void> {
    console.log(`[outbox] → ${message.event_type} (tenant ${message.tenant_id}, key ${message.idempotency_key})`);
  }
}

export interface RelayOptions {
  intervalMs?: number;
  batchSize?: number;
  transport?: Transport;
}

/**
 * Start the polling loop. Returns a stop function (idempotent). One batch per tick;
 * ticks are scheduled only after the previous one settles, so a slow batch never
 * overlaps itself.
 */
export function startOutboxRelay(options: RelayOptions = {}): () => void {
  const intervalMs = options.intervalMs ?? 2_000;
  const batchSize = options.batchSize ?? 20;
  const transport = options.transport ?? new LogTransport();

  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const tick = async (): Promise<void> => {
    if (stopped) return;
    try {
      await withOutboxWorker((client) => relayBatch(client, transport, batchSize));
    } catch (err) {
      console.error('[outbox] relay cycle error', err);
    }
    if (!stopped) timer = setTimeout(tick, intervalMs);
  };

  timer = setTimeout(tick, intervalMs);

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
