-- FMIQ migration 003 — eventing backbone — DEV variant (embedded / Neon / Azure PG).
-- Identical to 003_eventing.sql. RLS is KEPT and FORCED so the outbox is exercised
-- exactly as in production (incl. by the RLS isolation suite and the relay tests).
BEGIN;

CREATE TABLE evt_outbox (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES core_tenant(id),
  event_type      text NOT NULL,
  payload         jsonb NOT NULL,
  idempotency_key text UNIQUE NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  available_at    timestamptz NOT NULL DEFAULT now(),
  processed_at    timestamptz,
  failed_at       timestamptz,
  attempts        int NOT NULL DEFAULT 0,
  last_error      text
);
CREATE INDEX ix_evt_outbox_pending ON evt_outbox (available_at)
  WHERE processed_at IS NULL AND failed_at IS NULL;

ALTER TABLE evt_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE evt_outbox FORCE ROW LEVEL SECURITY;
-- NULLIF(...,'') because the worker path leaves app.current_tenant unset, and a
-- reused pooled connection reports an unset custom GUC as '' (not NULL) — ''::uuid errors.
CREATE POLICY tenant_isolation ON evt_outbox
  USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
         OR current_setting('app.worker_mode', true) = 'on')
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
         OR current_setting('app.worker_mode', true) = 'on');
CREATE INDEX ix_evt_outbox_tenant ON evt_outbox (tenant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON evt_outbox TO fmiq_app;

COMMIT;
