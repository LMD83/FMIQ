-- FMIQ migration 014 — Handover Gate (capital → operations golden thread).
-- DEV variant. Mirrors 014_handover.sql.
-- On capital completion the Irish cert chain + COBie become the event that POPULATES
-- operations; go-live is blocked until the mandatory certs validate and COBie imports.
-- See docs/lifecycle-and-simplicity.md §1 and docs/FMIQ-master-build-plan.md §7.1.
BEGIN;

CREATE TABLE hov_handover (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES core_tenant(id),
  project_id         uuid REFERENCES prj_project(id),
  building_id        uuid REFERENCES est_building(id),
  status             text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','live','cancelled')),
  cobie_import_status text NOT NULL DEFAULT 'pending' CHECK (cobie_import_status IN ('pending','complete','failed')),
  went_live_at       timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE hov_cert (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES core_tenant(id),
  handover_id  uuid NOT NULL REFERENCES hov_handover(id),
  cert_type    text NOT NULL,   -- ccc | fsc | dac | safety_file | om_manual | cwmf_closeout | ancillary
  reference    text,
  bcms_ref     text,            -- BCAR / BCMS reference for the CCC (S.I. 9/2014)
  validated    boolean NOT NULL DEFAULT false,
  blob_uri     text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE hov_warranty (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES core_tenant(id),
  handover_id uuid REFERENCES hov_handover(id),
  asset_id    uuid REFERENCES est_asset(id),
  supplier    text,
  starts      date,
  ends        date,
  terms       text
);

CREATE TABLE hov_cobie_import_log (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES core_tenant(id),
  handover_id         uuid NOT NULL REFERENCES hov_handover(id),
  blob_uri            text,
  status              text NOT NULL DEFAULT 'complete' CHECK (status IN ('complete','failed')),
  components_imported int NOT NULL DEFAULT 0,
  schedules_created   int NOT NULL DEFAULT 0,
  warranties_created  int NOT NULL DEFAULT 0,
  spares_imported     int NOT NULL DEFAULT 0,
  errors              jsonb,
  created_at          timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['hov_handover','hov_cert','hov_warranty','hov_cobie_import_log'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format($p$CREATE POLICY tenant_isolation ON %I
        USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);$p$, t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS ix_%I_tenant ON %I (tenant_id);', t, t);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON hov_handover, hov_cert, hov_warranty, hov_cobie_import_log TO fmiq_app;

COMMIT;
