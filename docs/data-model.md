# FMIQ Data Model (Postgres)

Conventions: every tenant-scoped table carries `tenant_id uuid not null` with RLS enabled and a composite index leading on `tenant_id`. `id uuid default gen_random_uuid()`. Timestamps `created_at/updated_at timestamptz`. Soft-delete via `deleted_at`. Naming nods to GovIQ conventions (`core_`, `est_`, `cc_` for collection-care, `wo_`, `cmp_`).

## Tenancy & identity

```sql
core_tenant(id, name, slug, plan_tier, entra_tenant_id, data_region, created_at)
core_user(id, tenant_id, entra_object_id, email, display_name, lang /* en|ga */, status)
core_role(id, code /* SystemAdmin..ReadOnly */, name)
core_user_role(tenant_id, user_id, role_id)
core_audit_log(id, tenant_id, user_id, entity, entity_id, action, before jsonb, after jsonb, at) -- immutable
```

RLS pattern applied to all tenant tables:
```sql
ALTER TABLE est_asset ENABLE ROW LEVEL SECURITY;
ALTER TABLE est_asset FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON est_asset
  USING (tenant_id = current_setting('app.current_tenant')::uuid);
CREATE INDEX ON est_asset (tenant_id, id);
```

## Estate hierarchy & assets

```sql
est_site(id, tenant_id, name, address, geo geography(Point), heritage_status, county)
est_building(id, tenant_id, site_id, name, year_built, protected_structure bool,
             national_monument bool, gia_m2, condition_grade /* A-D */)
est_floor(id, tenant_id, building_id, name, level_index, nia_m2)
est_space(id, tenant_id, floor_id, name, space_type /* gallery|store|office|plant|public */,
          nia_m2, cost_centre, is_collection_zone bool)
-- A "zone" for collection care is an est_space (gallery/store) or a cc_case within it.
est_asset(id, tenant_id, space_id, code, name, asset_type, manufacturer, install_date,
          condition_grade, criticality, qr_uid, parent_asset_id)
est_fabric_element(id, tenant_id, building_id, element_type /* roof|masonry|window|M&E */,
                   material, condition_grade, last_survey_id) -- heritage fabric
est_ifc_import(id, tenant_id, building_id, blob_uri, status, entities_extracted int)
```

## Collection care (the wedge)

```sql
cc_case(id, tenant_id, space_id, name, case_type /* display|vitrine|drawer|shelf */, sealed bool)
cc_zone(id, tenant_id, space_id, cc_case_id null, name) -- monitored zone (room, case, or store)
cc_standard(id, code /* PAS198|BS4971|ASHRAE_AA..D|BIZOT_2023 */, name, description)
cc_zone_target(id, tenant_id, cc_zone_id, cc_standard_id, active bool,
   temp_min, temp_max, rh_min, rh_max, rh_rate_max_per_24h,
   lux_max, uv_max_uw_per_lm, co2_max_ppm) -- per-zone, per-standard config
cc_sensor(id, tenant_id, cc_zone_id, vendor /* conserv|hanwell|tandd|hobo|bms */,
   external_id, metrics text[], last_seen_at, battery_pct, calibrated_until, status)

-- TimescaleDB hypertable: high-frequency readings
cc_reading(tenant_id, sensor_id, zone_id, metric /* temp|rh|lux|uv|co2|voc|shock */,
           value double precision, unit, quality, ts timestamptz);
SELECT create_hypertable('cc_reading', 'ts');
-- continuous aggregate for dashboards
CREATE MATERIALIZED VIEW cc_reading_hourly WITH (timescaledb.continuous) AS
  SELECT tenant_id, zone_id, metric, time_bucket('1 hour', ts) bucket,
         avg(value) avg, min(value) min, max(value) max
  FROM cc_reading GROUP BY 1,2,3,4;

cc_excursion(id, tenant_id, cc_zone_id, cc_zone_target_id, metric,
   kind /* absolute|rate_of_change */, severity /* watch|breach|critical */,
   started_at, ended_at, peak_value, ack_by, ack_at, work_order_id, resolution_note)
cc_object_link(id, tenant_id, cc_zone_id, cms_vendor /* axiell|tms */, cms_object_id,
   object_name, material, sensitivity /* low|med|high */, on_loan bool) -- from CMS
cc_loan(id, tenant_id, cc_zone_id, lender, ref, starts, ends, lender_spec jsonb,
   compliance_pct) -- live loan compliance
cc_ipm_trap(id, tenant_id, space_id, code, trap_type)
cc_ipm_observation(id, tenant_id, trap_id, species, count, ts, action)
```

The excursion→object link is the magic: on `cc_excursion` insert, the API queries `cc_object_link` for the zone to name at-risk objects, raises a `wo_work_order`, and routes alerts.

## Maintenance, compliance, projects, H&S

```sql
wo_work_order(id, tenant_id, space_id, asset_id null, source /* reactive|ppm|excursion|inspection */,
   cc_excursion_id null, priority, sla_due, status, assignee_id, contractor_id,
   conservation_notes, opened_at, closed_at)
wo_ppm_schedule(id, tenant_id, asset_id, task_template_id, frequency, next_due, sfg20_ref)
wo_task_template(id, code, name, discipline, standard_ref /* SFG20/CIBSE */)
wo_contractor(id, tenant_id, name, prequal_status, insurance_expiry, inductions jsonb)

cmp_obligation(id, tenant_id, building_id, type /* fire|asbestos|legionella|electrical */,
   frequency, next_due, owner_id, status_rag)
cmp_inspection(id, tenant_id, obligation_id, space_id, performed_by, performed_at,
   checklist jsonb, result, photos text[])
cmp_defect(id, tenant_id, inspection_id, severity, collections_risk bool, cost_estimate,
   remedial_work_order_id)

prj_project(id, tenant_id, name, cwmf_stage, budget, spend, status_rag, gantt jsonb,
   closure_impact jsonb)
prj_drawdown(id, tenant_id, project_id, valuation_no, amount, certified_by, certified_at)

hs_incident(id, tenant_id, space_id, kind /* incident|near_miss */, reporter_type,
   riddor_reportable bool, investigation jsonb, status)
```

## Sustainability

```sql
sus_meter(id, tenant_id, building_id, utility /* elec|gas|water|oil */, unit)
sus_reading(tenant_id, meter_id, value, ts) -- hypertable
sus_carbon(id, tenant_id, building_id, scope /* 1|2|3 */, period, tco2e)
sus_bizot_compliance(id, tenant_id, cc_zone_id, period, pct_hours_in_band, energy_kwh)
```

## Notes
- All `*_reading` tables are TimescaleDB hypertables with retention (raw 90d) + compression + 7y aggregates.
- PostGIS for `est_site.geo` and floor-plan/zone polygons (map view).
- `core_audit_log` is append-only (no UPDATE/DELETE grant) to satisfy FOI / GDPR accountability.
- Object catalogue is **not** replicated — only `cc_object_link` references + sensitivity (data minimisation).
