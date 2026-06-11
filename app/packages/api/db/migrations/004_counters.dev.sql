-- FMIQ migration 004 — per-tenant counters — DEV variant. Identical to 004_counters.sql.
BEGIN;

CREATE TABLE core_counter (
  tenant_id uuid NOT NULL REFERENCES core_tenant(id),
  scope     text NOT NULL,
  value     bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, scope)
);

ALTER TABLE core_counter ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_counter FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON core_counter
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON core_counter TO fmiq_app;

COMMIT;
