-- FMIQ migration 016 — lifecycle costing / capital replacement planning.
-- DEV variant. Mirrors 016_lifecycle.sql.
-- See docs/FMIQ-master-build-plan.md §4.6 / docs/FMIQ-operations-modules-spec.md §4.
BEGIN;

ALTER TABLE est_asset ADD COLUMN design_life_years    int;
ALTER TABLE est_asset ADD COLUMN replacement_cost     numeric;
ALTER TABLE est_asset ADD COLUMN commission_date      date;
ALTER TABLE est_asset ADD COLUMN condition_survey_date date;

-- Costed, risk-ranked backlog (deferred capital), incl. collections risk.
CREATE TABLE lcc_backlog (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES core_tenant(id),
  asset_id         uuid REFERENCES est_asset(id),
  description      text NOT NULL,
  cost_estimate    numeric,
  risk_score       int NOT NULL DEFAULT 0,     -- 0..100
  collections_risk boolean NOT NULL DEFAULT false,
  funded           boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['lcc_backlog'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format($p$CREATE POLICY tenant_isolation ON %I
        USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);$p$, t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS ix_%I_tenant ON %I (tenant_id);', t, t);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON lcc_backlog TO fmiq_app;

COMMIT;
