# ADR-003 — Eventing backbone (transactional outbox)

**Status:** Accepted (2026-06-08) · **Decision owner:** Liam / GovIQ · **Implements:** `FMIQ-master-build-plan.md` §3.1; Sprint 1 GOV-72/73.

## Context

Many modules must react to domain changes asynchronously: an excursion opens → notify the Conservation Officer + FM; a PPM falls due → raise a WO; a cert is expiring → escalate; a requisition is approved → commit budget. These reactions must be **reliable** (never lost) and **atomic** with the change that triggered them — if the excursion commits, its event must too, and vice-versa. A naive "write row, then publish to a broker" double-write loses events on a crash between the two steps.

## Decision

A **transactional outbox**.

- **`emitEvent(client, opts)`** writes a **CloudEvents 1.0** envelope to **`evt_outbox`** using the *same* client/transaction as the domain write, so they commit or roll back together. `idempotency_key` + `ON CONFLICT (idempotency_key) DO NOTHING` makes re-emits no-ops (e.g. `collectionCare.ts` keys on `excursion.opened:<excursionId>`).
- A **relay worker** (`relayBatch` via `withOutboxWorker`, loop in `workers/outboxRelay.ts`) claims pending rows with **`FOR UPDATE SKIP LOCKED`**, publishes each via a pluggable **`Transport`**, then marks `processed_at`. Failures increment `attempts`, record `last_error`, and set `available_at = now() + backoff` (exponential, capped 60s); after `MAX_ATTEMPTS` the row is dead-lettered (`failed_at`). Delivery is **at-least-once**; consumers dedupe on the CloudEvents `id`.
- **Worker visibility:** the emit path is tenant-scoped by RLS like every table. The relay must drain **all** tenants, so it is a trusted, non-request-path process that opts in via a transaction-local GUC `app.worker_mode='on'` (set only by `withOutboxWorker`). The `evt_outbox` policy also uses `NULLIF(current_setting('app.current_tenant',true),'')::uuid` because an unset custom GUC on a reused pooled connection reads as `''`, and `''::uuid` errors.
- **Transport** is an interface: `LogTransport` for MVP, Azure Service Bus (+ ACS email) in production. The relay runs **in-process with the API in dev** (`OUTBOX_RELAY`, default on) and as a **standalone Container App** in production.

## Consequences

- Domain events are never lost and never partially applied — the core reliability property.
- Consumers must be **idempotent** (dedupe on event `id`) because delivery is at-least-once.
- The outbox is a hot table; the partial index `ix_evt_outbox_pending (available_at) WHERE processed_at IS NULL AND failed_at IS NULL` keeps the relay query cheap. A retention/archival job for processed rows is a follow-up.
- The schema adds `available_at`, `failed_at`, `last_error` beyond the master-plan sketch to support time-based backoff and dead-lettering — a deliberate, documented extension.
- Canonical topics/types follow `fmiq.<area>.<event>` (e.g. `fmiq.excursion.opened`). The relay's transport maps these to Service Bus topics later.

## Alternatives considered

- **Direct publish in the handler** (no outbox): rejected — not atomic; a crash between DB commit and broker publish loses the event.
- **Postgres `LISTEN/NOTIFY`:** rejected as the backbone — not durable (a disconnected listener misses events) and no retry/dead-letter. May still be used later for low-latency UI push, not for guaranteed delivery.
- **Dedicated `fmiq_worker` BYPASSRLS role** instead of the worker GUC: a valid production hardening (clearer than a GUC), but adds a role + a second connection string to dev/test/CI. The GUC keeps Sprint 1 self-contained and testable in embedded Postgres; switching to a worker role later is a localized change in `withOutboxWorker` + the policy.
