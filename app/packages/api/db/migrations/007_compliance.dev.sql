-- FMIQ migration 007 — compliance certificates, inspections & defects.
-- DEV variant. Mirrors 007_compliance.sql.
-- See docs/FMIQ-master-build-plan.md §4.4 and docs/FMIQ-spec-irish-regulatory.md §2.5.
BEGIN;

-- Extend the existing obligation register (additive — never edit a prior migration).
ALTER TABLE cmp_obligation ADD COLUMN cert_type_code text;
ALTER TABLE cmp_obligation ADD COLUMN auto_renewal_wo_days_lead int;

CREATE TABLE cmp_certificate (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES core_tenant(id),
  cert_type_code text NOT NULL,            -- fire_alarm | emerg_light | electrical | lift | legionella | f_gas | asbestos | bcar_ccc
  ref            text,
  issuer         text,
  issue_date     date,
  expiry_date    date,
  asset_id       uuid REFERENCES est_asset(id),
  building_id    uuid REFERENCES est_building(id),
  blob_uri       text,
  bcms_ref       text,                      -- BCAR / BCMS reference (S.I. 9/2014)
  owner_id       uuid REFERENCES core_user(id),
  status         text NOT NULL DEFAULT 'valid' CHECK (status IN ('valid','expired','superseded')),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE cmp_inspection (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES core_tenant(id),
  obligation_id  uuid REFERENCES cmp_obligation(id),
  certificate_id uuid REFERENCES cmp_certificate(id),
  space_id       uuid REFERENCES est_space(id),
  performed_by   uuid REFERENCES core_user(id),
  performed_at   timestamptz NOT NULL DEFAULT now(),
  result         text NOT NULL CHECK (result IN ('pass','fail')),
  photos         text[] NOT NULL DEFAULT '{}'
);

CREATE TABLE cmp_inspection_item (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES core_tenant(id),
  inspection_id uuid NOT NULL REFERENCES cmp_inspection(id),
  label         text NOT NULL,
  status        text NOT NULL CHECK (status IN ('pass','fail')),
  photo_uri     text,
  note          text
);

CREATE TABLE cmp_defect (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               uuid NOT NULL REFERENCES core_tenant(id),
  inspection_id           uuid REFERENCES cmp_inspection(id),
  severity                text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  collections_risk        boolean NOT NULL DEFAULT false,
  cost_estimate           numeric,
  remedial_work_order_id  uuid REFERENCES wo_work_order(id),
  status                  text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_at              timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['cmp_certificate','cmp_inspection','cmp_inspection_item','cmp_defect'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format($p$CREATE POLICY tenant_isolation ON %I
        USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);$p$, t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS ix_%I_tenant ON %I (tenant_id);', t, t);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON cmp_certificate, cmp_inspection, cmp_inspection_item, cmp_defect TO fmiq_app;

COMMIT;
