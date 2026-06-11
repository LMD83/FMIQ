-- FMIQ seed — National Museum of Ireland: full estate demo dataset.
-- Run after a migration on a fresh DB (npm run db:reset re-applies cleanly).
-- Preserves the Textile Gallery IDs the web "Simulate excursion" button posts to.
BEGIN;

INSERT INTO core_tenant (id, name, slug, plan_tier, data_region)
VALUES ('00000000-0000-0000-0000-0000000000a1','National Museum of Ireland','nmi','pilot','northeurope')
ON CONFLICT (slug) DO NOTHING;

SET app.current_tenant = '00000000-0000-0000-0000-0000000000a1';

INSERT INTO core_user (id, tenant_id, email, display_name, lang)
VALUES ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000a1','aoife@museum.ie','Aoife N.','en')
ON CONFLICT DO NOTHING;
INSERT INTO core_user_role (tenant_id, user_id, role_id)
SELECT '00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000b1', id FROM core_role WHERE code='ConservationOfficer'
ON CONFLICT DO NOTHING;

-- ============ Sites ============
INSERT INTO est_site (id, tenant_id, name, county, heritage_status) VALUES
 ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000a1','Archaeology — Kildare Street','Dublin','Protected Structure'),
 ('00000000-0000-0000-0000-0000000000c2','00000000-0000-0000-0000-0000000000a1','Decorative Arts & History — Collins Barracks','Dublin','Protected Structure (1702)'),
 ('00000000-0000-0000-0000-0000000000c3','00000000-0000-0000-0000-0000000000a1','Natural History — Merrion Street','Dublin','Protected Structure'),
 ('00000000-0000-0000-0000-0000000000c4','00000000-0000-0000-0000-0000000000a1','Country Life — Turlough Park','Mayo','Historic estate');

-- ============ Buildings ============
INSERT INTO est_building (id, tenant_id, site_id, name, year_built, protected_structure, condition_grade) VALUES
 ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000c1','Kildare Street Museum',1890,true,'B'),
 ('00000000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000c2','Collins Barracks (1702)',1702,true,'B'),
 ('00000000-0000-0000-0000-0000000000d3','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000c3','Natural History Building',1857,true,'C'),
 ('00000000-0000-0000-0000-0000000000d4','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000c4','Turlough Park House & Galleries',2001,false,'A');

-- ============ Floors ============
INSERT INTO est_floor (id, tenant_id, building_id, name, level_index) VALUES
 ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000d1','Ground Floor',0),
 ('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000d2','Second Floor',2),
 ('00000000-0000-0000-0000-0000000000e3','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000d2','Lower Ground',-1),
 ('00000000-0000-0000-0000-0000000000e4','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000d3','First Floor',1),
 ('00000000-0000-0000-0000-0000000000e5','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000d4','Galleries',1);

-- ============ Spaces (galleries + stores) ============
-- Textile Gallery (0f1) preserved.
INSERT INTO est_space (id, tenant_id, floor_id, name, space_type, is_collection_zone) VALUES
 ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000e2','Textile Gallery','gallery',true),
 ('00000000-0000-0000-0000-0000000000f2','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000e1','Treasury','gallery',true),
 ('00000000-0000-0000-0000-0000000000f3','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000e1','Viking Gallery','gallery',true),
 ('00000000-0000-0000-0000-0000000000f4','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000e3','Textile Store','store',true),
 ('00000000-0000-0000-0000-0000000000f5','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000e2','Silver & Decorative Arts','gallery',true),
 ('00000000-0000-0000-0000-0000000000f6','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000e4','Mammal Hall','gallery',true),
 ('00000000-0000-0000-0000-0000000000f7','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000e4','Irish Room','gallery',true),
 ('00000000-0000-0000-0000-0000000000f8','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000e5','Folklife Store','store',true),
 ('00000000-0000-0000-0000-0000000000f9','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000e3','Archive Store','store',true);

-- ============ Zones (one per space) ============
INSERT INTO cc_zone (id, tenant_id, space_id, name) VALUES
 ('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000f1','Textile Gallery'),
 ('00000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000f2','Treasury'),
 ('00000000-0000-0000-0000-000000000103','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000f3','Viking Gallery'),
 ('00000000-0000-0000-0000-000000000104','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000f4','Textile Store'),
 ('00000000-0000-0000-0000-000000000105','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000f5','Silver & Decorative Arts'),
 ('00000000-0000-0000-0000-000000000106','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000f6','Mammal Hall'),
 ('00000000-0000-0000-0000-000000000107','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000f7','Irish Room'),
 ('00000000-0000-0000-0000-000000000108','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000f8','Folklife Store'),
 ('00000000-0000-0000-0000-000000000109','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000f9','Archive Store');

-- ============ Per-zone targets (standard-based) ============
INSERT INTO cc_zone_target (id, tenant_id, cc_zone_id, cc_standard_id, temp_min, temp_max, rh_min, rh_max, rh_rate_max_per_24h, lux_max, uv_max_uw_per_lm)
SELECT v.id, '00000000-0000-0000-0000-0000000000a1', v.zone, s.id, v.tmin, v.tmax, v.rmin, v.rmax, v.rate, v.lux, 75
FROM (VALUES
 ('00000000-0000-0000-0000-000000000111'::uuid,'00000000-0000-0000-0000-000000000101'::uuid,'ASHRAE_A',18,22,45,55,5,50),
 ('00000000-0000-0000-0000-000000000112'::uuid,'00000000-0000-0000-0000-000000000102'::uuid,'ASHRAE_AA',19,21,45,55,3,50),
 ('00000000-0000-0000-0000-000000000113'::uuid,'00000000-0000-0000-0000-000000000103'::uuid,'ASHRAE_A',18,22,45,55,5,50),
 ('00000000-0000-0000-0000-000000000114'::uuid,'00000000-0000-0000-0000-000000000104'::uuid,'BS4971',16,20,45,55,5,50),
 ('00000000-0000-0000-0000-000000000115'::uuid,'00000000-0000-0000-0000-000000000105'::uuid,'ASHRAE_A',18,22,45,55,5,150),
 ('00000000-0000-0000-0000-000000000116'::uuid,'00000000-0000-0000-0000-000000000106'::uuid,'BIZOT_2023',16,25,40,60,10,200),
 ('00000000-0000-0000-0000-000000000117'::uuid,'00000000-0000-0000-0000-000000000107'::uuid,'BIZOT_2023',16,25,40,60,10,200),
 ('00000000-0000-0000-0000-000000000118'::uuid,'00000000-0000-0000-0000-000000000108'::uuid,'BS4971',16,20,45,55,5,50),
 ('00000000-0000-0000-0000-000000000119'::uuid,'00000000-0000-0000-0000-000000000109'::uuid,'BS4971',16,20,45,55,5,50)
) AS v(id, zone, std, tmin, tmax, rmin, rmax, rate, lux)
JOIN cc_standard s ON s.code = v.std;

-- ============ Sensors (one per zone) ============
INSERT INTO cc_sensor (id, tenant_id, cc_zone_id, vendor, external_id, metrics, status, battery_pct) VALUES
 ('00000000-0000-0000-0000-000000000121','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000101','conserv','CNSV-TXG-01','{temp,rh,lux,uv}','online',87),
 ('00000000-0000-0000-0000-000000000122','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000102','conserv','CNSV-TRE-01','{temp,rh,lux}','online',91),
 ('00000000-0000-0000-0000-000000000123','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000103','hanwell','HW-VIK-04','{temp,rh,lux,uv}','online',64),
 ('00000000-0000-0000-0000-000000000124','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000104','conserv','CNSV-TXS-02','{temp,rh}','online',78),
 ('00000000-0000-0000-0000-000000000125','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000105','conserv','CNSV-SIL-01','{temp,rh,lux}','online',95),
 ('00000000-0000-0000-0000-000000000126','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000106','hanwell','HW-MAM-02','{temp,rh}','online',55),
 ('00000000-0000-0000-0000-000000000127','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000107','hanwell','HW-IRR-01','{temp,rh}','online',60),
 ('00000000-0000-0000-0000-000000000128','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000108','tandd','TD-FLS-01','{temp,rh}','online',82),
 ('00000000-0000-0000-0000-000000000129','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000109','conserv','CNSV-ARC-03','{temp,rh}','online',88);

-- ============ Latest readings (drive zone-grid RAG) ============
-- (rh, temp) per zone. Values chosen to show OK / watch variety.
INSERT INTO cc_reading (tenant_id, sensor_id, zone_id, metric, value, unit, ts) VALUES
 ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000121','00000000-0000-0000-0000-000000000101','rh',50.2,'%',now()),
 ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000121','00000000-0000-0000-0000-000000000101','temp',21.4,'C',now()),
 ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000122','00000000-0000-0000-0000-000000000102','rh',50.1,'%',now()),
 ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000122','00000000-0000-0000-0000-000000000102','temp',20.0,'C',now()),
 ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000123','00000000-0000-0000-0000-000000000103','rh',51.8,'%',now()),
 ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000123','00000000-0000-0000-0000-000000000103','temp',20.4,'C',now()),
 ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000124','00000000-0000-0000-0000-000000000104','rh',54.1,'%',now()),
 ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000124','00000000-0000-0000-0000-000000000104','temp',18.9,'C',now()),
 ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000125','00000000-0000-0000-0000-000000000105','rh',49.7,'%',now()),
 ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000125','00000000-0000-0000-0000-000000000105','temp',20.8,'C',now()),
 ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000126','00000000-0000-0000-0000-000000000106','rh',58.9,'%',now()),
 ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000126','00000000-0000-0000-0000-000000000106','temp',19.2,'C',now()),
 ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000127','00000000-0000-0000-0000-000000000107','rh',55.0,'%',now()),
 ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000127','00000000-0000-0000-0000-000000000107','temp',18.7,'C',now()),
 ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000128','00000000-0000-0000-0000-000000000108','rh',52.3,'%',now()),
 ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000128','00000000-0000-0000-0000-000000000108','temp',17.8,'C',now()),
 ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000129','00000000-0000-0000-0000-000000000109','rh',46.4,'%',now()),
 ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000129','00000000-0000-0000-0000-000000000109','temp',18.2,'C',now());

-- 24h RH history for the Textile Gallery (hero trend), stable ~50% with mild daily wave.
INSERT INTO cc_reading (tenant_id, sensor_id, zone_id, metric, value, unit, ts)
SELECT '00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000121','00000000-0000-0000-0000-000000000101','rh',
       50 + sin(g/3.0)*1.6 + (random()-0.5), '%', now() - (g || ' hours')::interval
FROM generate_series(1,24) g;

-- ============ Objects at risk (from Axiell) in Textile Gallery ============
INSERT INTO cc_object_link (tenant_id, cc_zone_id, cms_vendor, cms_object_id, object_name, material, sensitivity) VALUES
 ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000101','axiell','DT:1972.45','Silk court mantua, 1740s','Silk / metal thread','high'),
 ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000101','axiell','DT:1988.12','Polychrome carved oak panel','Wood / gesso / pigment','high'),
 ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000101','axiell','DT:1955.03','Vellum charter, 15th c.','Parchment','high'),
 ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000106','axiell','NH:1901.77','Giant Irish Deer skeleton','Bone / antler','med'),
 ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000102','axiell','AR:1868.01','Tara Brooch','Silver-gilt / glass','high');

-- ============ Contractors ============
INSERT INTO wo_contractor (id, tenant_id, name, prequal_status, insurance_expiry) VALUES
 ('00000000-0000-0000-0000-000000000131','00000000-0000-0000-0000-0000000000a1','Mercury Mechanical (HVAC)','approved','2027-03-31'),
 ('00000000-0000-0000-0000-000000000132','00000000-0000-0000-0000-0000000000a1','Heritage Stone & Roofing Ltd','approved','2026-11-30');

-- Contractor compliance vault (hs_competency) — Safe Pass / RECI / liabilities with expiry.
INSERT INTO hs_competency (tenant_id, contractor_id, comp_type, reference, issued_on, expiry, verified) VALUES
 ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000131','safe_pass','SP-44821','2024-02-01','2028-02-01',true),
 ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000131','public_liability','PL-7781002','2025-01-01','2027-01-01',true),
 ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000132','safe_pass','SP-90233','2023-06-01','2025-06-01',true),
 ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000132','public_liability','PL-5540019','2025-02-01','2027-02-01',false);

-- ============ Standing work orders (reactive / ppm / inspection) ============
INSERT INTO wo_work_order (tenant_id, ref, space_id, source, priority, sla_due, status, title, conservation_notes, opened_at) VALUES
 ('00000000-0000-0000-0000-0000000000a1','WO-20611','00000000-0000-0000-0000-0000000000f6','ppm','routine', now()+interval '5 days','open','AHU filter replacement — Natural History', null, now()-interval '1 day'),
 ('00000000-0000-0000-0000-0000000000a1','WO-20609','00000000-0000-0000-0000-0000000000f3','reactive','high', now()+interval '1 day','assigned','Lux above target — relamp Viking Gallery','Reduce display illuminance to <=50 lux for sensitive metalwork.', now()-interval '2 days'),
 ('00000000-0000-0000-0000-0000000000a1','WO-20604','00000000-0000-0000-0000-0000000000f1','ppm','routine', now()+interval '7 days','open','Quarterly fire damper inspection — Collins Barracks', null, now()-interval '3 days'),
 ('00000000-0000-0000-0000-0000000000a1','WO-20598','00000000-0000-0000-0000-0000000000f2','reactive','high', now()+interval '2 days','in_progress','Roof lead flashing repair — Kildare Street','Protected structure — heritage roofing contractor only.', now()-interval '4 days'),
 ('00000000-0000-0000-0000-0000000000a1','WO-20593','00000000-0000-0000-0000-0000000000f8','ppm','routine', now()+interval '6 days','open','Dehumidifier service — Folklife Store', null, now()-interval '2 days'),
 ('00000000-0000-0000-0000-0000000000a1','WO-20590','00000000-0000-0000-0000-0000000000f4','inspection','high', now()+interval '1 day','assigned','Pest activity — casemaking moth, Textile Store','IPM: isolate affected items, increase trap density, inspect adjacent bays.', now()-interval '1 day');

-- ============ Compliance obligations ============
INSERT INTO cmp_obligation (tenant_id, building_id, type, frequency, next_due, status_rag) VALUES
 ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000d2','Fire risk assessment','Annual', current_date+interval '67 days','green'),
 ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000d3','Legionella (L8) monitoring','Monthly', current_date+interval '12 days','amber'),
 ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000d1','Asbestos re-inspection','Annual', current_date+interval '26 days','amber'),
 ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000d4','Fixed wiring (electrical)','5-yearly', current_date+interval '520 days','green'),
 ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000d2','Lift (LOLER) examination','6-monthly', current_date+interval '24 days','amber'),
 ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000d1','Conservation fabric survey','Tri-annual', current_date+interval '101 days','green');

-- ============ Capital projects (CWMF) ============
INSERT INTO prj_project (tenant_id, name, cwmf_stage, budget, spend, status_rag) VALUES
 ('00000000-0000-0000-0000-0000000000a1','Natural History refurbishment','Stage 4 — Construction',14200000,8804000,'green'),
 ('00000000-0000-0000-0000-0000000000a1','Collins Barracks store upgrade','Stage 2 — Design',2800000,672000,'green'),
 ('00000000-0000-0000-0000-0000000000a1','Kildare St. environmental controls','Stage 3 — Tender',1600000,176000,'amber');

-- ============ Assets (plant for PPM + register) ============
INSERT INTO est_asset (id, tenant_id, space_id, code, name, asset_type, manufacturer, condition_grade, criticality) VALUES
 ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000f6','AHU-NH-01','Air handling unit — Mammal Hall','HVAC','Trane','B','high'),
 ('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000f4','DEHU-TS-01','Dehumidifier — Textile Store','HVAC','Munters','B','high'),
 ('00000000-0000-0000-0000-0000000000e3','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000f2','LIFT-KS-01','Passenger lift — Kildare Street','Lift','Otis','C','medium'),
 ('00000000-0000-0000-0000-0000000000e4','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000f1','FA-PANEL-01','Fire alarm panel — Textile Gallery','Life safety','Kentec','A','high'),
 ('00000000-0000-0000-0000-0000000000e5','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000f3','EL-CCT-VK','Emergency lighting circuit — Viking Gallery','Life safety','Hochiki','B','medium'),
 ('00000000-0000-0000-0000-0000000000e6','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000f5','DB-DA-01','Electrical distribution board — Decorative Arts','Electrical','Schneider','C','high');

-- ============ PPM schedules (SFG20-aligned, statutory classification) ============
INSERT INTO wo_ppm_schedule (tenant_id, asset_id, task_template_id, frequency, lead_days, next_due, classification, statutory_flag)
SELECT '00000000-0000-0000-0000-0000000000a1', s.asset_id::uuid, t.id, t.default_frequency, 14, s.next_due, s.cls, s.stat
FROM (VALUES
  ('00000000-0000-0000-0000-0000000000e4','FIRE-ALARM-Q','red',true, current_date+interval '9 days'),
  ('00000000-0000-0000-0000-0000000000e5','EMERG-LIGHT-A','red',true, current_date+interval '21 days'),
  ('00000000-0000-0000-0000-0000000000e3','LIFT-LOLER-6M','pink',true, current_date+interval '5 days'),
  ('00000000-0000-0000-0000-0000000000e6','ELEC-FIXED-5Y','amber',true, current_date+interval '180 days'),
  ('00000000-0000-0000-0000-0000000000e1','AHU-FILTER-Q','green',false, current_date+interval '28 days'),
  ('00000000-0000-0000-0000-0000000000e2','AHU-FILTER-Q','amber',false, current_date+interval '3 days')
) AS s(asset_id, code, cls, stat, next_due)
JOIN wo_task_template t ON t.code = s.code;

-- ============ Compliance certificates (register + escalating alerts) ============
INSERT INTO cmp_certificate (tenant_id, cert_type_code, ref, issuer, issue_date, expiry_date, building_id, status) VALUES
 ('00000000-0000-0000-0000-0000000000a1','fire_alarm','FA-2025-114','Kentec Approved', current_date-interval '11 months', current_date+interval '23 days','00000000-0000-0000-0000-0000000000d1','valid'),
 ('00000000-0000-0000-0000-0000000000a1','emerg_light','EL-2025-090','SparkSafe', current_date-interval '11 months', current_date+interval '9 days','00000000-0000-0000-0000-0000000000d2','valid'),
 ('00000000-0000-0000-0000-0000000000a1','lift','LOLER-2026-04','Otis', current_date-interval '5 months', current_date+interval '31 days','00000000-0000-0000-0000-0000000000d1','valid'),
 ('00000000-0000-0000-0000-0000000000a1','legionella','L8-2026-03','AquaCare', current_date-interval '1 month', current_date+interval '5 days','00000000-0000-0000-0000-0000000000d3','valid'),
 ('00000000-0000-0000-0000-0000000000a1','electrical','EICR-2022-77','SparkSafe', current_date-interval '38 months', current_date-interval '5 days','00000000-0000-0000-0000-0000000000d4','expired'),
 ('00000000-0000-0000-0000-0000000000a1','asbestos','ASB-2025-12','EnviroSurvey', current_date-interval '10 months', current_date+interval '60 days','00000000-0000-0000-0000-0000000000d2','valid');

-- ============ Stores / inventory (some below minimum → reorder) ============
INSERT INTO inv_part (id, tenant_id, code, name, critical, unit_cost) VALUES
 ('00000000-0000-0000-0000-0000000a0001','00000000-0000-0000-0000-0000000000a1','FLT-AHU-G4','AHU filter G4 (pleated)',true,18.50),
 ('00000000-0000-0000-0000-0000000a0002','00000000-0000-0000-0000-0000000000a1','LAMP-LED-50','LED lamp 50 lux conservation-grade',false,12.00),
 ('00000000-0000-0000-0000-0000000a0003','00000000-0000-0000-0000-0000000000a1','BELT-FAN-A','Fan drive belt (AHU)',true,9.25),
 ('00000000-0000-0000-0000-0000000a0004','00000000-0000-0000-0000-0000000000a1','TRAP-IPM-BL','IPM blunder trap (insect)',false,3.40),
 ('00000000-0000-0000-0000-0000000a0005','00000000-0000-0000-0000-0000000000a1','GEL-SILICA-5','Silica gel conditioning pack 5kg',true,42.00);
INSERT INTO inv_stock (tenant_id, part_id, store_location, qty_on_hand, qty_reserved, min_qty) VALUES
 ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000a0001','Swords store',24,4,10),
 ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000a0002','Swords store',6,0,8),
 ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000a0003','Swords store',2,1,3),
 ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000a0004','Collins Barracks',55,0,20),
 ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000a0005','Swords store',1,0,4);

-- ============ Approvals (chain + requisitions across the workflow) ============
INSERT INTO apr_chain (id, tenant_id, name, category, min_amount, max_amount, steps) VALUES
 ('00000000-0000-0000-0000-0000000c0001','00000000-0000-0000-0000-0000000000a1','Revenue ≤ €25k','revenue',0,2500000,'["FacilitiesManager"]'::jsonb);
INSERT INTO apr_requisition (tenant_id, chain_id, cost_centre, amount_net, category, status, current_step) VALUES
 ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000c0001','NMI-FM-OPS',1850.00,'revenue','pending_approval',0),
 ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000c0001','NMI-FM-OPS',640.00,'revenue','pending_approval',0),
 ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000c0001','NMI-CONS',12400.00,'capital','approved',1),
 ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000c0001','NMI-FM-OPS',3200.00,'revenue','committed',1);

COMMIT;
