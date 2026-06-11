-- FMIQ migration 017 — sustainability: utilities, carbon, Bizot Green Protocol, SEAI.
-- DEV variant. Mirrors prod minus the TimescaleDB hypertable.
-- See docs/data-model.md (Sustainability) and docs/FMIQ-master-build-plan.md §I/roadmap.
BEGIN;

CREATE TABLE sus_meter (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES core_tenant(id),
  building_id uuid REFERENCES est_building(id),
  utility     text NOT NULL CHECK (utility IN ('elec','gas','water','oil')),
  unit        text NOT NULL DEFAULT 'kWh',
  mprn        text
);

CREATE TABLE sus_reading (
  tenant_id uuid NOT NULL,
  meter_id  uuid NOT NULL,
  value     double precision NOT NULL,
  ts        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_sus_reading_meter ON sus_reading (tenant_id, meter_id, ts DESC);

CREATE TABLE sus_carbon (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES core_tenant(id),
  building_id uuid REFERENCES est_building(id),
  scope       int NOT NULL CHECK (scope IN (1,2,3)),
  period      text NOT NULL,
  tco2e       numeric NOT NULL DEFAULT 0
);

CREATE TABLE sus_bizot_compliance (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES core_tenant(id),
  cc_zone_id       uuid REFERENCES cc_zone(id),
  period           text NOT NULL,
  pct_hours_in_band numeric NOT NULL DEFAULT 0,
  energy_kwh       numeric
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['sus_meter','sus_reading','sus_carbon','sus_bizot_compliance'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format($p$CREATE POLICY tenant_isolation ON %I
        USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);$p$, t);
  END LOOP;
END $$;
CREATE INDEX ix_sus_meter_tenant ON sus_meter (tenant_id, id);
CREATE INDEX ix_sus_carbon_tenant ON sus_carbon (tenant_id, id);
CREATE INDEX ix_sus_bizot_compliance_tenant ON sus_bizot_compliance (tenant_id, id);

GRANT SELECT, INSERT, UPDATE, DELETE ON sus_meter, sus_reading, sus_carbon, sus_bizot_compliance TO fmiq_app;

COMMIT;
