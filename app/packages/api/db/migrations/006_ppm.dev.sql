-- FMIQ migration 006 — PPM — DEV variant. Mirrors prod minus the TimescaleDB hypertable.
BEGIN;

CREATE TABLE wo_task_template (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                 text UNIQUE NOT NULL,
  name                 text NOT NULL,
  discipline           text,
  required_skill       text,
  standard_ref         text,
  est_minutes          int,
  permit_type_required text,
  parts_required       jsonb NOT NULL DEFAULT '[]'::jsonb,
  statutory_flag       boolean NOT NULL DEFAULT false,
  classification       text NOT NULL DEFAULT 'green' CHECK (classification IN ('red','pink','amber','green')),
  default_frequency    text
);
INSERT INTO wo_task_template (code, name, discipline, standard_ref, est_minutes, permit_type_required, statutory_flag, classification, default_frequency) VALUES
  ('FIRE-ALARM-Q','Fire alarm quarterly service','Fire','I.S. 3218', 120, null, true, 'red', '3 mons'),
  ('EMERG-LIGHT-A','Emergency lighting annual discharge test','Electrical','I.S. 3217', 180, null, true, 'red', '1 year'),
  ('ELEC-FIXED-5Y','Fixed wiring periodic inspection','Electrical','I.S. 10101', 480, 'electrical_isolation', true, 'red', '5 years'),
  ('LEGIONELLA-M','Legionella temperature monitoring','Water','S.I. 572/2013', 60, null, true, 'red', '1 mon'),
  ('LIFT-LOLER-6M','Lift thorough examination','Mechanical','S.I. 299/2007', 120, null, true, 'red', '6 mons'),
  ('AHU-FILTER-Q','AHU filter inspection & change','HVAC','SFG20-17', 90, null, false, 'amber', '3 mons');

CREATE TABLE wo_ppm_schedule (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES core_tenant(id),
  asset_id         uuid NOT NULL REFERENCES est_asset(id),
  task_template_id uuid NOT NULL REFERENCES wo_task_template(id),
  trigger_type     text NOT NULL DEFAULT 'calendar' CHECK (trigger_type IN ('calendar','meter','seasonal','condition')),
  frequency        text,
  lead_days        int NOT NULL DEFAULT 14,
  next_due         date,
  sfg20_ref        text,
  classification   text NOT NULL DEFAULT 'green' CHECK (classification IN ('red','pink','amber','green')),
  statutory_flag   boolean NOT NULL DEFAULT false,
  last_wo_id       uuid REFERENCES wo_work_order(id),
  active           boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE wo_meter_reading (
  tenant_id  uuid NOT NULL,
  asset_id   uuid NOT NULL,
  meter_type text NOT NULL,
  value      double precision NOT NULL,
  ts         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_wo_meter_reading_asset ON wo_meter_reading (tenant_id, asset_id, meter_type, ts DESC);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['wo_ppm_schedule','wo_meter_reading'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format($p$CREATE POLICY tenant_isolation ON %I
        USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);$p$, t);
  END LOOP;
END $$;
CREATE INDEX ix_wo_ppm_schedule_tenant ON wo_ppm_schedule (tenant_id, id);

GRANT SELECT ON wo_task_template TO fmiq_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON wo_ppm_schedule, wo_meter_reading TO fmiq_app;

COMMIT;
