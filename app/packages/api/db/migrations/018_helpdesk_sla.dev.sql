-- FMIQ migration 018 — self-service helpdesk intake + SLA policies.
-- DEV variant. Mirrors 018_helpdesk_sla.sql.
-- Closes core CAFM gaps: the primary museum demand channel (curators/wardens logging
-- issues) and configurable SLA tiers. See FMIQ-system-review.md §4.
BEGIN;

-- Self-service service requests — the front door before a work order exists.
CREATE TABLE req_request (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES core_tenant(id),
  channel         text NOT NULL DEFAULT 'web' CHECK (channel IN ('web','email','qr','phone','mobile')),
  requester_name  text,
  requester_email text,
  requester_id    uuid REFERENCES core_user(id),
  category        text,
  description     text NOT NULL,
  space_id        uuid REFERENCES est_space(id),
  asset_id        uuid REFERENCES est_asset(id),
  priority        text NOT NULL DEFAULT 'routine' CHECK (priority IN ('routine','high','critical')),
  status          text NOT NULL DEFAULT 'open' CHECK (status IN ('open','triaged','converted','rejected','duplicate')),
  sla_due         timestamptz,
  work_order_id   uuid REFERENCES wo_work_order(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_req_request_open ON req_request (tenant_id, created_at DESC) WHERE status = 'open';

-- Configurable SLA tiers (response + fix minutes by priority).
CREATE TABLE wo_sla_policy (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES core_tenant(id),
  name          text NOT NULL,
  priority      text NOT NULL CHECK (priority IN ('routine','high','critical')),
  response_mins int NOT NULL,
  fix_mins      int NOT NULL,
  active        boolean NOT NULL DEFAULT true,
  UNIQUE (tenant_id, priority)
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['req_request','wo_sla_policy'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format($p$CREATE POLICY tenant_isolation ON %I
        USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);$p$, t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS ix_%I_tenant ON %I (tenant_id);', t, t);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON req_request, wo_sla_policy TO fmiq_app;

COMMIT;
