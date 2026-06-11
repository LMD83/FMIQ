-- FMIQ migration 003 — eventing backbone (transactional outbox)
-- Target: PostgreSQL 16 (production). Pairs with 003_eventing.dev.sql — keep in sync.
--
-- Domain writes and their events are committed in the SAME transaction via this
-- outbox (see src/domain/outbox.ts). A relay worker (src/workers/outboxRelay.ts)
-- polls unprocessed rows with FOR UPDATE SKIP LOCKED and publishes them (Service Bus
-- in production; a log transport for MVP), then marks them processed. At-least-once
-- delivery; consumers deduplicate on the CloudEvents id. See docs/adr-003-eventing-outbox.md
-- and docs/FMIQ-master-build-plan.md §3.1.
BEGIN;

CREATE TABLE evt_outbox (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES core_tenant(id),
  event_type      text NOT NULL,                         -- e.g. 'fmiq.excursion.opened'
  payload         jsonb NOT NULL,                        -- CloudEvents 1.0 envelope
  idempotency_key text UNIQUE NOT NULL,                  -- dedup key; ON CONFLICT DO NOTHING
  created_at      timestamptz NOT NULL DEFAULT now(),
  available_at    timestamptz NOT NULL DEFAULT now(),    -- earliest next dispatch (backoff)
  processed_at    timestamptz,                           -- set on successful publish
  failed_at       timestamptz,                           -- set when attempts exhausted (dead-letter)
  attempts        int NOT NULL DEFAULT 0,
  last_error      text
);
-- The relay's hot path: pending rows due for dispatch, oldest first.
CREATE INDEX ix_evt_outbox_pending ON evt_outbox (available_at)
  WHERE processed_at IS NULL AND failed_at IS NULL;

-- =====================================================================
-- Row-Level Security. The emit path is tenant-scoped exactly like every
-- other table; the relay worker is a TRUSTED, NON-request-path process that
-- must drain ALL tenants, so it opts in via a transaction-local GUC
-- (app.worker_mode='on', set only by withOutboxWorker). App/request code never
-- sets it, so tenant isolation is intact on the emit path. (In production this
-- can instead be a dedicated BYPASSRLS worker role — see the ADR.)
-- =====================================================================
ALTER TABLE evt_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE evt_outbox FORCE ROW LEVEL SECURITY;
-- NULLIF(...,'') because the worker path leaves app.current_tenant unset, and a
-- reused pooled connection reports an unset custom GUC as '' (not NULL) — ''::uuid errors.
CREATE POLICY tenant_isolation ON evt_outbox
  USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
         OR current_setting('app.worker_mode', true) = 'on')
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
         OR current_setting('app.worker_mode', true) = 'on');
CREATE INDEX ix_evt_outbox_tenant ON evt_outbox (tenant_id, id);

GRANT SELECT, INSERT, UPDATE, DELETE ON evt_outbox TO fmiq_app;

COMMIT;
