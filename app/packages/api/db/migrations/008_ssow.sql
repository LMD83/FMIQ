-- FMIQ migration 008 — Safe System of Work: the Readiness Gate's data.
-- Target: PostgreSQL 16 (production). Pairs with 008_ssow.dev.sql.
-- "No paperwork, no work": a WO cannot start until RAMS/permit/competency/pre-task/keys
-- are green. The checks live in src/domain/gateEngine.ts (GATE_REGISTRY.ssow_readiness).
-- See docs/FMIQ-master-build-plan.md §5 and docs/adr-002-gate-engine.md.
BEGIN;

-- Per-WO requirement flags drive which gate checks apply (default off → existing WOs unaffected).
ALTER TABLE wo_work_order ADD COLUMN requires_rams boolean NOT NULL DEFAULT false;
ALTER TABLE wo_work_order ADD COLUMN required_permit_type text;
ALTER TABLE wo_work_order ADD COLUMN requires_key boolean NOT NULL DEFAULT false;

CREATE TABLE hs_rams (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES core_tenant(id),
  work_order_id uuid REFERENCES wo_work_order(id),
  title         text NOT NULL,
  version       int NOT NULL DEFAULT 1,
  status        text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','under_review','approved','rejected','expired')),
  approved_by   uuid REFERENCES core_user(id),
  approved_at   timestamptz,
  valid_to      date,
  blob_uri      text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE hs_permit (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES core_tenant(id),
  work_order_id uuid REFERENCES wo_work_order(id),
  permit_type   text NOT NULL,    -- hot_works | confined_space | work_at_height | electrical_isolation | roof_heritage | near_collections
  status        text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','suspended','closed')),
  valid_from    timestamptz,
  valid_to      timestamptz,
  authoriser_id uuid REFERENCES core_user(id),
  isolations    jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE hs_competency (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES core_tenant(id),
  contractor_id uuid REFERENCES wo_contractor(id),
  user_id       uuid REFERENCES core_user(id),
  comp_type     text NOT NULL,    -- safe_pass | reci | rgii | trade_cert | insurance | induction
  expiry        date,
  blob_uri      text
);

CREATE TABLE hs_key_register (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES core_tenant(id),
  code       text NOT NULL,
  name       text NOT NULL,
  restricted boolean NOT NULL DEFAULT false
);

CREATE TABLE hs_keyloan (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES core_tenant(id),
  key_id        uuid NOT NULL REFERENCES hs_key_register(id),
  work_order_id uuid REFERENCES wo_work_order(id),
  signed_out_by uuid REFERENCES core_user(id),
  signed_out_at timestamptz NOT NULL DEFAULT now(),
  returned_at   timestamptz
);

CREATE TABLE hs_pretask (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES core_tenant(id),
  work_order_id uuid REFERENCES wo_work_order(id),
  by_user       uuid REFERENCES core_user(id),
  completed_at  timestamptz NOT NULL DEFAULT now(),
  checklist     jsonb NOT NULL DEFAULT '{}'::jsonb,
  new_hazard    boolean NOT NULL DEFAULT false
);

CREATE TABLE hs_incident (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES core_tenant(id),
  space_id         uuid REFERENCES est_space(id),
  kind             text NOT NULL DEFAULT 'incident' CHECK (kind IN ('incident','near_miss')),
  reporter_type    text,
  riddor_reportable boolean NOT NULL DEFAULT false,
  investigation    jsonb,
  status           text NOT NULL DEFAULT 'open' CHECK (status IN ('open','investigating','closed')),
  created_at       timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['hs_rams','hs_permit','hs_competency','hs_key_register','hs_keyloan','hs_pretask','hs_incident'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format($p$CREATE POLICY tenant_isolation ON %I
        USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);$p$, t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS ix_%I_tenant ON %I (tenant_id, id);', t, t);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON hs_rams, hs_permit, hs_competency, hs_key_register, hs_keyloan, hs_pretask, hs_incident TO fmiq_app;

COMMIT;
