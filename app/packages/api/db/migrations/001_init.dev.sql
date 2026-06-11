-- FMIQ schema 001 — DEV variant for vanilla Postgres (Neon, local PG, Azure PG).
-- Identical to 001_init.sql MINUS TimescaleDB/PostGIS/role-creation (production-only).
-- RLS is KEPT and FORCED, so tenant isolation is genuinely enforced even in dev.
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Tenancy & identity ---------------------------------------------------
CREATE TABLE core_tenant (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, slug text UNIQUE NOT NULL,
  plan_tier text NOT NULL DEFAULT 'standard',
  entra_tenant_id text, data_region text NOT NULL DEFAULT 'northeurope',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE core_user (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES core_tenant(id),
  entra_object_id text, email text NOT NULL, display_name text NOT NULL,
  lang text NOT NULL DEFAULT 'en' CHECK (lang IN ('en','ga')),
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (tenant_id, email)
);
CREATE TABLE core_role (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text UNIQUE NOT NULL, name text NOT NULL);
INSERT INTO core_role (code,name) VALUES
 ('SystemAdmin','System Administrator'),('TenantAdmin','Tenant Administrator'),
 ('FacilitiesManager','Facilities Manager'),('ConservationOfficer','Conservation Officer'),
 ('MaintenanceTech','Maintenance Technician'),('ReadOnly','Read Only');
CREATE TABLE core_user_role (
  tenant_id uuid NOT NULL REFERENCES core_tenant(id),
  user_id uuid NOT NULL REFERENCES core_user(id),
  role_id uuid NOT NULL REFERENCES core_role(id), PRIMARY KEY (user_id, role_id)
);
CREATE TABLE core_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, user_id uuid,
  entity text NOT NULL, entity_id uuid, action text NOT NULL,
  before jsonb, after jsonb, at timestamptz NOT NULL DEFAULT now()
);

-- Estate ---------------------------------------------------------------
CREATE TABLE est_site (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES core_tenant(id),
  name text NOT NULL, address text, geo_lat double precision, geo_lng double precision,
  heritage_status text, county text
);
CREATE TABLE est_building (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES core_tenant(id),
  site_id uuid NOT NULL REFERENCES est_site(id), name text NOT NULL, year_built int,
  protected_structure boolean NOT NULL DEFAULT false, national_monument boolean NOT NULL DEFAULT false,
  gia_m2 numeric, condition_grade text CHECK (condition_grade IN ('A','B','C','D'))
);
CREATE TABLE est_floor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES core_tenant(id),
  building_id uuid NOT NULL REFERENCES est_building(id), name text NOT NULL,
  level_index int NOT NULL DEFAULT 0, nia_m2 numeric
);
CREATE TABLE est_space (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES core_tenant(id),
  floor_id uuid NOT NULL REFERENCES est_floor(id), name text NOT NULL,
  space_type text NOT NULL CHECK (space_type IN ('gallery','store','office','plant','public','circulation')),
  nia_m2 numeric, cost_centre text, is_collection_zone boolean NOT NULL DEFAULT false
);
CREATE TABLE est_asset (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES core_tenant(id),
  space_id uuid REFERENCES est_space(id), code text NOT NULL, name text NOT NULL, asset_type text,
  manufacturer text, install_date date, condition_grade text CHECK (condition_grade IN ('A','B','C','D')),
  criticality text, qr_uid text, parent_asset_id uuid REFERENCES est_asset(id)
);

-- Collection care ------------------------------------------------------
CREATE TABLE cc_case (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES core_tenant(id),
  space_id uuid NOT NULL REFERENCES est_space(id), name text NOT NULL,
  case_type text CHECK (case_type IN ('display','vitrine','drawer','shelf')), sealed boolean NOT NULL DEFAULT false
);
CREATE TABLE cc_zone (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES core_tenant(id),
  space_id uuid NOT NULL REFERENCES est_space(id), cc_case_id uuid REFERENCES cc_case(id), name text NOT NULL
);
CREATE TABLE cc_standard (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text UNIQUE NOT NULL, name text NOT NULL, description text);
INSERT INTO cc_standard (code,name,description) VALUES
 ('ASHRAE_AA','ASHRAE Class AA','No risk; 50% RH ±5%, no seasonal variation'),
 ('ASHRAE_A','ASHRAE Class A','Low risk; ±10% RH seasonal, ±5% daily'),
 ('ASHRAE_B','ASHRAE Class B','Moderate; ±10% RH daily'),
 ('BS4971','BS 4971:2017','Archive & library collections'),
 ('BIZOT_2023','Bizot Green Protocol 2023','16–25°C, 40–60% RH, ≤±10% RH/24h'),
 ('PAS198','PAS 198:2012','Risk-based environmental management');
CREATE TABLE cc_zone_target (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES core_tenant(id),
  cc_zone_id uuid NOT NULL REFERENCES cc_zone(id), cc_standard_id uuid NOT NULL REFERENCES cc_standard(id),
  active boolean NOT NULL DEFAULT true, temp_min numeric, temp_max numeric, rh_min numeric, rh_max numeric,
  rh_rate_max_per_24h numeric, lux_max numeric, uv_max_uw_per_lm numeric, co2_max_ppm numeric
);
CREATE TABLE cc_sensor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES core_tenant(id),
  cc_zone_id uuid NOT NULL REFERENCES cc_zone(id),
  vendor text NOT NULL CHECK (vendor IN ('conserv','hanwell','tandd','hobo','bms')),
  external_id text NOT NULL, metrics text[] NOT NULL DEFAULT '{}', last_seen_at timestamptz,
  battery_pct int, calibrated_until date, status text NOT NULL DEFAULT 'online'
);
-- Plain table in dev (TimescaleDB hypertable in production 001_init.sql)
CREATE TABLE cc_reading (
  tenant_id uuid NOT NULL, sensor_id uuid NOT NULL, zone_id uuid NOT NULL, metric text NOT NULL,
  value double precision NOT NULL, unit text, quality text DEFAULT 'good', ts timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_cc_reading_zone_metric ON cc_reading (tenant_id, zone_id, metric, ts DESC);
CREATE TABLE cc_excursion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES core_tenant(id),
  cc_zone_id uuid NOT NULL REFERENCES cc_zone(id), cc_zone_target_id uuid REFERENCES cc_zone_target(id),
  metric text NOT NULL, kind text NOT NULL CHECK (kind IN ('absolute','rate_of_change')),
  severity text NOT NULL CHECK (severity IN ('watch','breach','critical')),
  started_at timestamptz NOT NULL DEFAULT now(), ended_at timestamptz, peak_value double precision,
  ack_by uuid, ack_at timestamptz, work_order_id uuid, resolution_note text
);
CREATE TABLE cc_object_link (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES core_tenant(id),
  cc_zone_id uuid NOT NULL REFERENCES cc_zone(id), cms_vendor text CHECK (cms_vendor IN ('axiell','tms','mimsy')),
  cms_object_id text NOT NULL, object_name text NOT NULL, material text,
  sensitivity text NOT NULL DEFAULT 'med' CHECK (sensitivity IN ('low','med','high')), on_loan boolean NOT NULL DEFAULT false
);
CREATE TABLE cc_loan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES core_tenant(id),
  cc_zone_id uuid NOT NULL REFERENCES cc_zone(id), lender text NOT NULL, ref text, starts date, ends date,
  lender_spec jsonb, compliance_pct numeric
);

-- Maintenance / compliance / projects ---------------------------------
CREATE TABLE wo_contractor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES core_tenant(id),
  name text NOT NULL, prequal_status text, insurance_expiry date, inductions jsonb
);
CREATE TABLE wo_work_order (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES core_tenant(id),
  ref text NOT NULL, space_id uuid REFERENCES est_space(id), asset_id uuid REFERENCES est_asset(id),
  source text NOT NULL CHECK (source IN ('reactive','ppm','excursion','inspection')),
  cc_excursion_id uuid REFERENCES cc_excursion(id),
  priority text NOT NULL DEFAULT 'routine' CHECK (priority IN ('routine','high','critical')),
  sla_due timestamptz, status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','assigned','in_progress','closed')),
  assignee_id uuid REFERENCES core_user(id), contractor_id uuid REFERENCES wo_contractor(id),
  conservation_notes text, title text NOT NULL, opened_at timestamptz NOT NULL DEFAULT now(), closed_at timestamptz
);
ALTER TABLE cc_excursion ADD CONSTRAINT fk_exc_wo FOREIGN KEY (work_order_id) REFERENCES wo_work_order(id);
CREATE TABLE cmp_obligation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES core_tenant(id),
  building_id uuid REFERENCES est_building(id), type text NOT NULL, frequency text, next_due date,
  owner_id uuid REFERENCES core_user(id), status_rag text CHECK (status_rag IN ('green','amber','red'))
);
CREATE TABLE prj_project (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES core_tenant(id),
  name text NOT NULL, cwmf_stage text, budget numeric, spend numeric,
  status_rag text CHECK (status_rag IN ('green','amber','red')), closure_impact jsonb
);

-- Row-Level Security (kept in dev — this is the whole point) -----------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'core_user','core_user_role','core_audit_log',
    'est_site','est_building','est_floor','est_space','est_asset',
    'cc_case','cc_zone','cc_zone_target','cc_sensor','cc_excursion','cc_object_link','cc_loan',
    'wo_contractor','wo_work_order','cmp_obligation','prj_project'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format($p$CREATE POLICY tenant_isolation ON %I
        USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);$p$, t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS ix_%I_tenant ON %I (tenant_id);', t, t);
  END LOOP;
END $$;

COMMIT;
