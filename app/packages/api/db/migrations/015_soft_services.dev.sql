-- FMIQ migration 015 — soft services + IPM + waste.
-- DEV variant. Mirrors 015_soft_services.sql.
-- See docs/FMIQ-master-build-plan.md §4.5 / docs/FMIQ-operations-modules-spec.md §5.
BEGIN;

CREATE TABLE soft_spec (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES core_tenant(id),
  space_type text NOT NULL,            -- gallery | store | office | wc ...
  service    text NOT NULL,            -- cleaning | security | grounds | waste
  frequency  text,
  checklist  jsonb NOT NULL DEFAULT '[]'::jsonb,
  standard   text                      -- e.g. BICSc
);

CREATE TABLE soft_task (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES core_tenant(id),
  space_id   uuid REFERENCES est_space(id),
  spec_id    uuid REFERENCES soft_spec(id),
  frequency  text,
  next_due   date,
  assignee_id uuid REFERENCES core_user(id)
);

CREATE TABLE soft_completion (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES core_tenant(id),
  task_id           uuid REFERENCES soft_task(id),
  qr_scan           boolean NOT NULL DEFAULT false,
  location_verified boolean NOT NULL DEFAULT false,
  photo_uri         text,
  by_user           uuid REFERENCES core_user(id),
  completed_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ipm_trap (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES core_tenant(id),
  space_id  uuid REFERENCES est_space(id),
  code      text NOT NULL,
  trap_type text
);

CREATE TABLE ipm_observation (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              uuid NOT NULL REFERENCES core_tenant(id),
  trap_id                uuid NOT NULL REFERENCES ipm_trap(id),
  species                text,
  count                  int NOT NULL DEFAULT 0,
  material_risk          text,         -- textile | paper | organic | none
  collections_escalation boolean NOT NULL DEFAULT false,
  action                 text,
  ts                     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE waste_record (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES core_tenant(id),
  building_id uuid REFERENCES est_building(id),
  stream      text NOT NULL,           -- general | mixed_recycling | glass | wee | hazardous
  weight_kg   numeric,
  recycled    boolean NOT NULL DEFAULT false,
  cost        numeric,
  ts          timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['soft_spec','soft_task','soft_completion','ipm_trap','ipm_observation','waste_record'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format($p$CREATE POLICY tenant_isolation ON %I
        USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);$p$, t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS ix_%I_tenant ON %I (tenant_id);', t, t);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON soft_spec, soft_task, soft_completion, ipm_trap, ipm_observation, waste_record TO fmiq_app;

COMMIT;
