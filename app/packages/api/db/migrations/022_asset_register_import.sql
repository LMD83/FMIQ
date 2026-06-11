-- FMIQ migration 022 — Asset register extensions + self-serve import subsystem (imp_*).
-- Target: PostgreSQL 16 (production). Pairs with 022_asset_register_import.dev.sql — keep in sync.
-- Source: docs/product/PRD-asset-register-import.md §5 (D1–D4), Sprint-1 slice (§9).
--
-- Additive only. Notes:
--  * install_date (001), replacement_cost + condition_survey_date + design_life_years (016)
--    already exist on est_asset — NOT re-added. expected_life_years is the surveyor's
--    expected-life figure (PRD D1); design_life_years (016) remains the design-intent figure.
--  * condition_grade is already constrained to A–D (001). criticality was free text:
--    constrained here with CHECK ... NOT VALID because live rows may hold legacy
--    vocabulary (e.g. 'med' — seed data normalised in this change). Validate later with
--    ALTER TABLE est_asset VALIDATE CONSTRAINT chk_est_asset_criticality after backfill.
--  * imp_change is the append-only undo/audit ledger — UPDATE/DELETE revoked from fmiq_app.
BEGIN;

-- =====================================================================
-- D1 — est_asset extensions + timestamps/soft-delete on the est_* spine
-- =====================================================================
ALTER TABLE est_asset ADD COLUMN model               text;
ALTER TABLE est_asset ADD COLUMN serial_no           text;
ALTER TABLE est_asset ADD COLUMN asset_tag           text;   -- contractor barcode/tag (dedupe key 1)
ALTER TABLE est_asset ADD COLUMN uniclass_code       text;
ALTER TABLE est_asset ADD COLUMN sfg20_ref           text;
ALTER TABLE est_asset ADD COLUMN expected_life_years numeric;
ALTER TABLE est_asset ADD COLUMN warranty_expiry     date;
ALTER TABLE est_asset ADD COLUMN building_id         uuid REFERENCES est_building(id); -- levels-optional anchor (PRD §5 D1)
ALTER TABLE est_asset ADD COLUMN import_session_id   uuid;   -- provenance; FK added below after imp_session
ALTER TABLE est_asset ADD COLUMN source_row          int;    -- provenance: row in the source file
ALTER TABLE est_asset ADD COLUMN created_at          timestamptz NOT NULL DEFAULT now();
ALTER TABLE est_asset ADD COLUMN updated_at          timestamptz NOT NULL DEFAULT now();
ALTER TABLE est_asset ADD COLUMN deleted_at          timestamptz;  -- soft delete only

-- Normalise criticality onto the internal scale (PRD §5 D1). NOT VALID: existing rows
-- may violate; new writes are checked. Backfill then VALIDATE CONSTRAINT.
ALTER TABLE est_asset ADD CONSTRAINT chk_est_asset_criticality
  CHECK (criticality IS NULL OR criticality IN ('critical','high','medium','low')) NOT VALID;

-- NOTE: the PRD-D1 anchor CHECK (space OR building OR parent required) is deliberately
-- NOT added: NOT VALID checks still apply to new inserts, and the existing COBie
-- handover path (domain/handover.ts importCobie) legitimately inserts unanchored assets
-- when no default space is supplied. Revisit when that path anchors to a building.

-- Timestamps + soft delete on the location hierarchy (documented in docs/data-model.md,
-- absent from 001 — PRD §5.1 "known drift"; also required for create-only import undo).
ALTER TABLE est_site     ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE est_site     ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE est_site     ADD COLUMN deleted_at timestamptz;
ALTER TABLE est_building ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE est_building ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE est_building ADD COLUMN deleted_at timestamptz;
ALTER TABLE est_floor    ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE est_floor    ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE est_floor    ADD COLUMN deleted_at timestamptz;
ALTER TABLE est_space    ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE est_space    ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE est_space    ADD COLUMN deleted_at timestamptz;

-- Dedupe + provenance lookup indexes
CREATE INDEX ix_est_asset_tag          ON est_asset (tenant_id, asset_tag)  WHERE asset_tag IS NOT NULL;
CREATE INDEX ix_est_asset_serial_model ON est_asset (tenant_id, serial_no, model) WHERE serial_no IS NOT NULL;
CREATE INDEX ix_est_asset_import       ON est_asset (tenant_id, import_session_id) WHERE import_session_id IS NOT NULL;
CREATE INDEX ix_est_asset_building     ON est_asset (tenant_id, building_id) WHERE building_id IS NOT NULL;

-- =====================================================================
-- D2 — building-systems grouping, orthogonal to the location tree (COBie System)
-- =====================================================================
CREATE TABLE est_system (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES core_tenant(id),
  building_id      uuid REFERENCES est_building(id),
  name             text NOT NULL,
  system_type      text,
  parent_system_id uuid REFERENCES est_system(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);

CREATE TABLE est_asset_system (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES core_tenant(id),
  asset_id  uuid NOT NULL REFERENCES est_asset(id),
  system_id uuid NOT NULL REFERENCES est_system(id),
  UNIQUE (asset_id, system_id)
);

-- =====================================================================
-- D3 — custom attributes: explicit-creation only (the anti-Limble rule)
-- =====================================================================
CREATE TABLE est_attribute_def (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES core_tenant(id),
  code               text NOT NULL,
  name               text NOT NULL,
  data_type          text NOT NULL CHECK (data_type IN ('text','number','date','bool')),
  unit               text,
  created_via_import boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE est_asset_attribute (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES core_tenant(id),
  asset_id         uuid NOT NULL REFERENCES est_asset(id),
  attribute_def_id uuid NOT NULL REFERENCES est_attribute_def(id),
  value_text       text,
  value_num        numeric,
  value_date       date,
  value_bool       boolean,
  UNIQUE (asset_id, attribute_def_id)
);

-- =====================================================================
-- D4 — import session subsystem (imp_*)
-- =====================================================================
CREATE TABLE imp_session (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES core_tenant(id),
  created_by         uuid REFERENCES core_user(id),
  status             text NOT NULL DEFAULT 'draft' CHECK (status IN
                       ('draft','parsing','mapping','validating','hierarchy','dedupe',
                        'dry_run','committing','committed','undone','abandoned')),
  target_mode        text NOT NULL DEFAULT 'create_only' CHECK (target_mode IN
                       ('create_only','upsert','full_sync_preview')),
  profile            text NOT NULL DEFAULT 'generic' CHECK (profile IN ('generic','cobie')),
  current_stage      int  NOT NULL DEFAULT 0,
  source_fingerprint text,
  stats              jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  committed_at       timestamptz,
  undone_at          timestamptz,
  undo_expires_at    timestamptz
);

CREATE TABLE imp_file (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES core_tenant(id),
  session_id  uuid NOT NULL REFERENCES imp_session(id),
  blob_uri    text,            -- object storage in production; null while staged rows carry the data
  filename    text NOT NULL,
  size_bytes  bigint,
  kind        text NOT NULL DEFAULT 'original' CHECK (kind IN ('original','correction','error_export','dryrun_report')),
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE imp_sheet (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES core_tenant(id),
  session_id     uuid NOT NULL REFERENCES imp_session(id),
  file_id        uuid NOT NULL REFERENCES imp_file(id),
  name           text NOT NULL,
  classification text NOT NULL DEFAULT 'data' CHECK (classification IN ('data','lookup','notes','skipped')),
  header_row     int,
  union_group    text,
  row_count      int
);

CREATE TABLE imp_mapping (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               uuid NOT NULL REFERENCES core_tenant(id),
  session_id              uuid NOT NULL REFERENCES imp_session(id),
  sheet_id                uuid REFERENCES imp_sheet(id),
  source_column           text NOT NULL,
  target_field            text,           -- null = ignored column
  transform               jsonb,          -- split/merge/unit rules (Sprint 2+)
  confidence              numeric,
  provenance              text NOT NULL DEFAULT 'none' CHECK (provenance IN ('exact','remembered','fuzzy','ai','manual','none')),
  accepted_by             uuid REFERENCES core_user(id),
  custom_attribute_def_id uuid REFERENCES est_attribute_def(id)
);

CREATE TABLE imp_value_map (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES core_tenant(id),
  session_id   uuid NOT NULL REFERENCES imp_session(id),
  target_field text NOT NULL,
  source_value text NOT NULL,
  mapped_value text,
  provenance   text NOT NULL DEFAULT 'manual' CHECK (provenance IN ('exact','remembered','fuzzy','ai','manual')),
  accepted_by  uuid REFERENCES core_user(id),
  UNIQUE (session_id, target_field, source_value)
);

CREATE TABLE imp_row (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES core_tenant(id),
  session_id      uuid NOT NULL REFERENCES imp_session(id),
  sheet_id        uuid REFERENCES imp_sheet(id),
  source_row_no   int  NOT NULL,
  raw             jsonb NOT NULL,    -- source values keyed by source column header
  normalised      jsonb,             -- typed values keyed by target field
  state           text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','valid','warning','error','excluded')),
  dedupe_group_id uuid,
  resolution      jsonb,             -- { action: 'create'|'skip', assetId?, reason? }
  issues          jsonb
);
CREATE INDEX ix_imp_row_session_state ON imp_row (tenant_id, session_id, state);

CREATE TABLE imp_entity_decision (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES core_tenant(id),
  session_id   uuid NOT NULL REFERENCES imp_session(id),
  entity       text NOT NULL CHECK (entity IN ('site','building','floor','space','system','type','attribute')),
  inbound_key  text NOT NULL,        -- pipe-joined path, e.g. 'Kildare St|Main Block|Level 1|Rm 1.04'
  action       text NOT NULL CHECK (action IN ('link','create')),
  linked_id    uuid,
  confidence   numeric,
  confirmed_by uuid REFERENCES core_user(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, entity, inbound_key)
);

-- Before/after ledger powering the 7-day undo and the result diff. APPEND-ONLY.
CREATE TABLE imp_change (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES core_tenant(id),
  session_id uuid NOT NULL REFERENCES imp_session(id),
  entity     text NOT NULL,
  entity_id  uuid NOT NULL,
  action     text NOT NULL CHECK (action IN ('insert','update','soft_delete')),
  before     jsonb,
  after      jsonb,
  at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_imp_change_session ON imp_change (tenant_id, session_id);

CREATE TABLE imp_mapping_memory (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES core_tenant(id),
  source_fingerprint text NOT NULL DEFAULT '',
  source_column      text NOT NULL,
  target_field       text NOT NULL,
  last_used_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, source_fingerprint, source_column)
);

-- Provenance FK back onto the register (declared after imp_session exists)
ALTER TABLE est_asset ADD CONSTRAINT fk_est_asset_import_session
  FOREIGN KEY (import_session_id) REFERENCES imp_session(id);

-- =====================================================================
-- Row-Level Security — every new tenant table gets the 001 treatment.
-- =====================================================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'est_system','est_asset_system','est_attribute_def','est_asset_attribute',
    'imp_session','imp_file','imp_sheet','imp_mapping','imp_value_map','imp_row',
    'imp_entity_decision','imp_change','imp_mapping_memory'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format($p$CREATE POLICY tenant_isolation ON %I
        USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);$p$, t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS ix_%I_tenant ON %I (tenant_id, id);', t, t);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  est_system, est_asset_system, est_attribute_def, est_asset_attribute,
  imp_session, imp_file, imp_sheet, imp_mapping, imp_value_map, imp_row,
  imp_entity_decision, imp_change, imp_mapping_memory
TO fmiq_app;

-- imp_change is append-only for the app role (mirrors core_audit_log in 001)
REVOKE UPDATE, DELETE ON imp_change FROM fmiq_app;

COMMIT;
