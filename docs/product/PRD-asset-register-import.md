# PRD — FMIQ Asset Register + Import Module

Version: v0.1 | Generated: 2026-06-11 | Owner: Nexum Intelligence Systems Limited

**Module:** Estate & Asset Register (PRD §5.A) + the self-serve Import Wizard.
**Primary requirements source:** [`docs/research/02-asset-import-ux.md`](../research/02-asset-import-ux.md) (cited as "Research §n" throughout).
**Builds on:** `docs/data-model.md`, `app/packages/api/db/migrations/001_init.sql`, `docs/roadmap.md` Phase 1 ("manual entry + CSV"), `docs/PROJECT-PLAN.md` EP-1, `docs/OUTSTANDING.md` item 1.9.

## Revision history

| Version | Date | Change |
|---|---|---|
| v0.1 | 2026-06-11 | Initial PRD from research brief 02. |

---

## 1. Problem + evidence

The asset register is the spine of FMIQ — every module (PPM, work orders, compliance, lifecycle costing, collection care) writes back to `est_asset` (master build plan §"AIM is the spine"). Today the register can only be populated by raw SQL or single-record CRUD; NMI's estate is seeded by hand (OUTSTANDING 1.9). Without a production import path there is no self-serve onboarding, and onboarding is where IWMS implementations die:

- The majority of CMMS implementation failures are attributed to bad data, not bad software; a documented university case imported 14,000 assets of which 3,200 were duplicates (Research, intro).
- Incumbent importers force fix-the-file-and-re-upload loops (MaintainX errors cannot be fixed in the upload summary; 1,000-row file limit), silently create taxonomy entities on name mismatch (Limble typos create new custom fields; MaintainX auto-creates locations/types/vendors), and impose strict template conventions (Fiix parent-by-location-code, no indentation) (Research §2.1–2.2).
- Enterprise CAFM (Planon, MRI Evolution) treats import as a consultant-led data-migration services engagement (Research §2.1). A self-serve, audit-grade importer is therefore both an activation feature and a competitive wedge — directly relevant to public procurement responses including NMI.
- The artefact we will actually receive from Irish/UK public estates is a survey workbook, not a clean CSV: one sheet per building/discipline, junk rows above the header, merged/carried-down location cells, quantity rows, mixed date formats, sentinels ("N/A", "TBC"), and condition/criticality in local vocabularies (A-D, 1-5, Good/Fair/Poor, RAG) (Research §3.3). HSE Estates' own baseline across ~4,440 buildings is survey spreadsheets, not structured registers (Research §3.2).
- Public clients increasingly mandate COBie handover under BS EN ISO 19650; recognising a COBie workbook and loading it without manual mapping is a genuine procurement differentiator (Research §3.1).

**Design target:** the messy survey workbook of Research §3.3, imported end-to-end with no Excel round-trip, no silent writes, and a full audit trail.

---

## 2. Personas + top use cases

Personas (Research §6 + existing `core_role` set):

| Persona | FMIQ role | Relationship to module |
|---|---|---|
| FM admin / Head of Estates | `FacilitiesManager` / `TenantAdmin` | Owns the register; runs imports; resolves mapping/dedupe decisions |
| Surveying contractor | external (no login in v1) | Authors the spreadsheet; receives the annotated error file; never touches FMIQ directly |
| Maintenance technician | `MaintenanceTech` | Consumes the register daily (search, scan, asset detail) |
| Conservation officer | `ConservationOfficer` | Reads condition/criticality for collection-zone plant |
| FMIQ onboarding support | `SystemAdmin` (observer) | Joins an import session via link to assist |

Use cases ranked by frequency:

1. **Browse/search/filter the register** (daily, every persona) — find an asset by name/code/tag/location; tree navigation; open detail.
2. **View/edit a single asset** (daily) — condition, criticality, photos, location, parent.
3. **Periodic survey re-import / upsert** (monthly–quarterly) — last month's updated condition survey; only condition/cost fields change (Research §6 edge case 11).
4. **Initial bulk onboarding import** (once per tenant per estate, but the highest-stakes interaction — Research intro: "the first material interaction a new FM client has with FMIQ").
5. **COBie handover ingest** (per capital project completion; feeds the Phase-2 Handover Gate).
6. **Register export** (ad hoc — audit, funder, survey commissioning).

---

## 3. Scope (MVP for pilot) / non-goals

### In scope (v1)

- Register browse/search/detail/CRUD over the existing `est_*` hierarchy, including asset tree (parent/child) and location tree.
- Import wizard per Research §6: persistent, resumable Import Session; stages 0–7 (upload → parse/detect → auto-map with confidence → value mapping → fix-in-grid validation → hierarchy resolution → dedupe → dry-run → commit with audit + 7-day undo).
- File formats: `.xlsx`, `.xls`, `.csv`, `.tsv`; 50 MB / 50,000-row ceiling (Research §6 Stage 0).
- Import targets: create-only, upsert, full-sync preview (flag missing assets, never auto-archive).
- COBie 2.4 ingest profile (auto-recognise Facility/Floor/Space/Type/Component/System sheets) — reuses the same session/commit machinery; satisfies roadmap "IFC import deferred" by shipping COBie-spreadsheet without IFC geometry.
- Mapping memory per tenant and per source-system fingerprint.
- AI assistance limited to the pattern research validates (Research §5): suggestion of column mappings, value mappings, and deterministic transform rules — always confirmable, logged, reproducible. No unreviewed AI writes; no per-row generative transformation.

### Non-goals (v1)

- IFC/BIM geometry parsing and 2D/3D viewers (master build plan: P3).
- Mobile survey capture app (the Mobiess/PocketSurvey space) — separate product decision.
- Fabric-element register import (`est_fabric_element`) — schema exists in docs only; follows once table lands.
- Sensor/CSV environmental data import (covered by research brief 05 / `SensorAdapter`).
- Auto-archive of register assets missing from a full-sync file — flag only.
- Embedding Flatfile/OneSchema: enterprise pricing plus third-party data transit conflicts with Irish public-sector residency posture; build on open parsing libraries (Research §6 build-vs-buy note).

---

## 4. UX flows

### 4.1 Import wizard (the canonical flow, Research §1.5 + §6)

A stepper: **Upload → Detect → Map → Values → Fix → Hierarchy → Dedupe → Dry-run → Commit**, with progress persisted per stage; the session survives refresh and is resumable. Nothing touches the live register until Commit.

**Stage 0 — Upload.** Drag-and-drop + picker; accepted formats and row/size ceiling visible. Three entry paths, with "upload what you have" as the headline (Research §2.2 implication d): (a) upload any spreadsheet, (b) download self-validating Excel template, (c) COBie workbook. Choose target mode: create-only / upsert / full-sync preview.

**Stage 1 — Parse + detect.** Encoding/BOM/delimiter detection, legacy `.xls`. Multi-sheet classification (data/lookup/notes) with user tick-list; "same schema split by building" unions sheets and exposes sheet name as a mappable virtual column (Research edge case 1). Header-row auto-detection skipping junk rows, two-row header (name + units) merge, visual override (edge case 3). Merged-cell/carry-down columns forward-filled as ghosted values with one confirmation per column (edge case 2). Dropped blank/repeat rows counted and shown. COBie sheet-name signature detected here switches the session to the COBie profile (edge case 10).

**Stage 2 — Auto-map with confidence.** Layered matching: exact header > remembered mapping (org, then source fingerprint) > fuzzy/synonym > AI suggestion from header + sampled values. Every mapping shows a confidence badge and provenance (exact/remembered/fuzzy/AI) and is overridable — never silently map (Research §1.5 pattern 3). High-confidence pre-accepted; unmapped/low-confidence sorted to top. Per column: target field, first 5 distinct sample values, required indicator, split/merge tools, "import as custom attribute" (explicit confirmed action — the anti-Limble rule) or "ignore". Required-field gate: Asset Name plus a location anchor (site or building); all else optional.

**Stage 3 — Value mapping.** For enum targets, distinct source values listed against FMIQ values: condition 1-5 / Good-Fair-Poor → A-D; criticality RAG / Normal-Important-Critical → FMIQ tiers; AI-prefilled, user-confirmed. Unmapped values become row warnings, never silent nulls (Research §6 Stage 2).

**Stage 4 — Validate + fix in grid.** Full pass: types; column-level date-format inference with user pick on ambiguity (DD/MM default for IE/UK); unit strip-and-normalise ("450 kW") recorded as conversions; enum membership; parent references; SFG20/Uniclass format checks; range checks (install date not future, replacement cost non-negative). **Errors block, warnings do not** (Research §1.2 — treating everything as a blocker kills completion). Grid: filter-to-errors, highlighted cells with plain-English messages, fix in place, column-scoped find-and-replace, per-column autofix with preview ("Convert 37 dates from DD/MM/YYYY"), exclude rows, undo stack. Annotated Excel export of error rows for the contractor; corrected file re-merges into the same session (Research §1.2 collaboration case). Quantity rows offer explode-to-N (suffix numbering) or single-asset-with-quantity, per asset type (edge case 7). Sentinels treated as blank, counted, reported (edge case 5).

**Stage 5 — Hierarchy resolution.** Location tree built from mapped Site/Building/Floor/Space columns; asset parent/child from Parent Asset column. Fuzzy-match inbound locations against existing register entities; explicit "links to existing" vs "creates new" with a confirm list of every new entity — no silent taxonomy creation (the Limble/MaintainX failure, Research §2.2). Cycle/self-parent/orphan detection with tree-preview resolution; absent parent offers stub-create or re-parent to location (edge case 9). Location and system hierarchies are kept orthogonal per COBie — never one tree (Research §4.1).

**Stage 6 — Dedupe review.** Match inbound vs existing and within-file on layered keys: asset tag/barcode > serial + model > name + space; configurable threshold. Per group: side-by-side compare, per-field choice — Skip / Update existing (field-level merge) / Create anyway — plus bulk actions. Within-file duplicate keys surfaced explicitly, never first-row-wins (the Airtable failure, Research §1.4). Duplicate serials across distinct assets = warning, not error (edge case 8).

**Stage 7 — Dry-run → Commit → Undo.** Dry-run: no-write simulation showing created/updated/skipped/warning counts, field-level change counts, every new location/type/attribute, tree preview, value-mapping recap; downloadable Excel sign-off report (public-sector approval record). Commit: transactional batch; partial failure rolls back. Every record stamped with import session, source file, source row, actor; every accepted AI suggestion logged with confidence. **Undo:** one-click full-session revert for 7 days or until a record is subsequently edited, whichever first — deletes untouched created records, restores prior values on updated ones. Result screen: counts, "View N imported assets" filtered link, "import another file" with mappings remembered. Admin import-history dashboard: all sessions, original file download, result diff, undo state.

Large files (to 50k rows): server-side batch validation, virtualised grid, resumable session — never freeze the tab (edge case 12).

### 4.2 Register browse/search/detail

- **List view:** virtualised table; full-text search across name/code/tag/serial/manufacturer/model; filters on site/building/space, asset type, condition A-D, criticality, classification code, import batch ("show me what last month's import created" — Research §1.5 pattern 6); saved views; column chooser; CSV/Excel export of the filtered set.
- **Tree view:** location hierarchy (Site → Building → Floor → Space) with asset counts per node; expandable asset parent/child beneath; system groupings as a secondary lens.
- **Detail view:** identity (code, tag, QR), classification (type, Uniclass, SFG20), location breadcrumb + parent asset, condition (grade A-D + survey date), criticality, lifecycle (install date, expected/remaining life, replacement cost, warranty expiry), custom attributes, provenance panel (import session, source file/row, who/when), audit history from `core_audit_log`, and links out to work orders/PPM (read-only stubs until those modules consume it).
- **Inline edit** with audit before/after; soft-delete only.

---

## 5. Data model — existing vs deltas

### 5.1 What exists (001_init.sql)

`est_site`, `est_building` (condition_grade A-D, heritage flags), `est_floor`, `est_space`, and `est_asset(id, tenant_id, space_id, code, name, asset_type, manufacturer, install_date, condition_grade A-D, criticality, qr_uid, parent_asset_id)` — all RLS-enabled, plus append-only `core_audit_log`. Location hierarchy and asset parent/child therefore already exist; condition A-D already constrained at building and asset level.

**Known drift to fix in passing:** `docs/data-model.md` lists `est_fabric_element` and `est_ifc_import`, which are absent from `001_init.sql`; `est_*` tables lack the documented `created_at/updated_at/deleted_at` columns; `est_asset.criticality` is unconstrained text.

### 5.2 Required deltas (migration `002_asset_register_import.sql`)

**D1 — `est_asset` extensions (ALTER):**

```sql
ALTER TABLE est_asset
  ADD COLUMN model text,
  ADD COLUMN serial_no text,
  ADD COLUMN asset_tag text,            -- contractor barcode/tag (dedupe key 1)
  ADD COLUMN quantity int NOT NULL DEFAULT 1,
  ADD COLUMN uniclass_code text,
  ADD COLUMN sfg20_code text,
  ADD COLUMN nrm_code text,
  ADD COLUMN expected_life_years numeric,
  ADD COLUMN remaining_life_years numeric,
  ADD COLUMN replacement_cost numeric,
  ADD COLUMN warranty_expiry date,
  ADD COLUMN condition_survey_date date,
  ADD COLUMN building_id uuid REFERENCES est_building(id),  -- location anchor when no space known
  ADD COLUMN notes text,
  ADD COLUMN import_session_id uuid,    -- provenance (FK added after imp_session)
  ADD COLUMN source_row int,
  ADD COLUMN created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN deleted_at timestamptz;
-- normalise criticality (Research §4.2: internal scale, inbound vocabularies map onto it)
ALTER TABLE est_asset ADD CONSTRAINT chk_criticality
  CHECK (criticality IN ('critical','high','medium','low'));
CHECK (space_id IS NOT NULL OR building_id IS NOT NULL OR parent_asset_id IS NOT NULL);
```

Rationale: SFG20 register guidance core columns + NHS lifecycle/cost fields (Research §3.1, §4.3); levels-optional anchoring (Research §4.1: "an asset may attach directly to a building").

**D2 — system hierarchy (NEW), orthogonal to location (Research §4.1, COBie System):**

```sql
est_system(id, tenant_id, building_id, name, system_type, parent_system_id)
est_asset_system(tenant_id, asset_id, system_id)   -- membership, not parentage
```

**D3 — custom attributes (NEW), explicit-creation only:**

```sql
est_attribute_def(id, tenant_id, code, name, data_type /* text|number|date|bool */, unit, created_via_import bool)
est_asset_attribute(tenant_id, asset_id, attribute_def_id, value_text, value_num, value_date, value_bool)
```

**D4 — import session subsystem (NEW prefix `imp_*`) — the biggest delta:**

```sql
imp_session(id, tenant_id, created_by, status /* draft|parsing|mapping|validating|hierarchy|dedupe|dry_run|committing|committed|undone|abandoned */,
   target_mode /* create_only|upsert|full_sync_preview */, profile /* generic|cobie */,
   current_stage int, source_fingerprint text, stats jsonb, created_at, committed_at, undo_expires_at)
imp_file(id, tenant_id, session_id, blob_uri, filename, size_bytes, kind /* original|correction|error_export|dryrun_report */, uploaded_at)
imp_sheet(id, tenant_id, session_id, file_id, name, classification /* data|lookup|notes|skipped */,
   header_row int, union_group text, row_count int)
imp_mapping(id, tenant_id, session_id, sheet_id null, source_column text, target_field text null,
   transform jsonb /* split/merge/unit rules */, confidence numeric, provenance /* exact|remembered|fuzzy|ai */,
   accepted_by uuid null, custom_attribute_def_id uuid null)
imp_value_map(id, tenant_id, session_id, target_field, source_value, mapped_value, provenance, accepted_by)
imp_row(id, tenant_id, session_id, sheet_id, source_row_no int, raw jsonb, normalised jsonb,
   state /* pending|valid|warning|error|excluded */, dedupe_group_id uuid null,
   resolution /* create|update:asset_id|skip */, issues jsonb)
imp_entity_decision(id, tenant_id, session_id, entity /* site|building|floor|space|system|type|attribute */,
   inbound_name text, action /* link|create */, linked_id uuid null, confirmed_by uuid)
imp_change(id, tenant_id, session_id, entity, entity_id, action /* insert|update */,
   before jsonb, after jsonb, at)   -- powers the 7-day undo + result diff
imp_mapping_memory(id, tenant_id, source_fingerprint, source_column, target_field, last_used_at)
```

All `imp_*` tables RLS-enabled per the standard pattern. `imp_change` is the undo ledger; commit also writes `core_audit_log` rows (action `asset.import_created` / `asset.import_updated`) so register history and import history reconcile.

**D5 — floor optionality:** `est_space.floor_id` is `NOT NULL`; survey data frequently has Site/Building/Room with no floor. Either relax to nullable with a `building_id` column on `est_space`, or auto-create a "Level 0" placeholder floor at hierarchy resolution. Decision at build time; placeholder preferred (no schema loosening), but it must appear in the Stage-5 confirm list — no silent creation.

**D6 — COBie profile mapping (no new tables):** Facility→`est_site`/`est_building`, Floor→`est_floor`, Space→`est_space`, Type→asset type + `est_attribute_def` rows, Component→`est_asset`, System→`est_system`. Spare/Job/Resource sheets parsed and parked (consumed by Phase-2 Handover Gate per master build plan §7.1).

---

## 6. API surface

Fastify, tenant-scoped via RLS (`withTenant`), RBAC: import endpoints require `FacilitiesManager`+; register reads any authenticated role; register writes `FacilitiesManager`+.

**Import sessions**

| Method + path | Purpose |
|---|---|
| `POST /api/imports` | Create session; multipart file upload; returns session + parse job |
| `GET /api/imports` / `GET /api/imports/:id` | History dashboard / session state (stage, stats, undo status) |
| `POST /api/imports/:id/files` | Add corrected file (merges into session) |
| `PUT /api/imports/:id/sheets` | Sheet selection, classification, union groups, header-row overrides |
| `GET/PUT /api/imports/:id/mappings` | Column mappings incl. confidence/provenance; accept/override/split/merge |
| `GET/PUT /api/imports/:id/value-maps` | Enum value mappings |
| `POST /api/imports/:id/validate` | Run/re-run server-side batch validation (async job) |
| `GET /api/imports/:id/rows?state=error&cursor=` | Paginated staged rows for the grid |
| `PATCH /api/imports/:id/rows` | Fix-in-grid edits, bulk find-replace, autofix apply, exclude |
| `GET /api/imports/:id/errors.xlsx` | Annotated error-row export |
| `POST /api/imports/:id/hierarchy/resolve` | Build/refresh trees + entity match candidates |
| `GET/PUT /api/imports/:id/entity-decisions` | Link-vs-create confirmations |
| `GET /api/imports/:id/duplicates` / `PUT .../resolutions` | Dedupe groups + per-field/bulk resolutions |
| `POST /api/imports/:id/dry-run` | Simulation; `GET .../dry-run.xlsx` sign-off report |
| `POST /api/imports/:id/commit` | Transactional commit (async job with progress) |
| `POST /api/imports/:id/undo` | Full-session revert within window |
| `GET /api/imports/template.xlsx` | Self-validating template generated from target schema |

**Register**

| Method + path | Purpose |
|---|---|
| `GET /api/assets?q=&site=&condition=&criticality=&type=&import_session=&cursor=` | Search/filter/paginate |
| `GET /api/assets/:id` | Detail incl. provenance + audit |
| `POST /api/assets` / `PATCH /api/assets/:id` / `DELETE /api/assets/:id` | CRUD (delete = soft) |
| `GET /api/locations/tree` / `GET /api/assets/:id/children` | Trees |
| `GET /api/systems` + CRUD | System groupings |
| `GET /api/attribute-defs` + CRUD | Custom attribute definitions |
| `GET /api/assets/export.xlsx` | Filtered export |

All mutations write `core_audit_log` with before/after. AI suggestion acceptances are logged (mapping id, confidence, actor) for the public-sector audit posture (Research §5).

---

## 7. Acceptance criteria

Adopted from Research §6 (AC1–AC10) verbatim as the v1 contract, plus register criteria:

1. A 5,000-row, 3-sheet survey workbook with merged location cells, 2 junk header rows and mixed date formats imports end-to-end with no Excel round-trip required.
2. ≥80 percent of columns auto-mapped correctly on first upload of an unseen file with conventional FM headers; 100 percent of auto-mappings display confidence + provenance and are overridable.
3. Zero silent writes: every new location, type, custom attribute, and value mapping is shown and confirmed before commit; dry-run counts equal commit counts exactly.
4. All validation errors are fixable in the grid; error rows exportable as annotated Excel; corrected file re-mergeable into the same session.
5. Dedupe catches 100 percent of exact tag/serial duplicates and presents fuzzy candidates above threshold; no within-file duplicate is silently dropped.
6. Commit is transactional; full-session undo restores the register to its pre-import state within the 7-day window (or until a record is edited); every record carries import session + source row provenance in the audit trail.
7. Condition (A-D), criticality, SFG20/Uniclass code, install date, remaining life and replacement cost are first-class mappable fields; inbound 1-5 and Good/Fair/Poor scales map via the value-mapping step.
8. A COBie 2.4 workbook (Facility/Floor/Space/Type/Component/System sheets) is auto-recognised and imports the location hierarchy and components without manual column mapping.
9. Session state survives browser refresh and is resumable; a 50,000-row file validates without UI freeze.
10. Import history lists every session with original file, result counts, actor, and undo status.
11. Messy-spreadsheet edge cases each have deterministic handling with a test fixture: union-by-sheet (sheet name as building), carry-down forward-fill with per-column confirm, two-row headers, units-in-values ("450 kW", "1,200 ltrs"), sentinels ("N/A"/"TBC"/"-"/"?") counted and reported, Excel-serial + text + mixed dates with column-level inference and DD/MM default, quantity-row explode/aggregate, duplicate-serial warning, absent-parent stub-create or re-parent.
12. Upsert re-import of a prior survey applies a "condition/cost fields only" scope option and shows a field-level diff before commit.
13. Register search returns results over a 50,000-asset tenant in <500 ms p95; list and tree views virtualise without freeze.
14. Every asset created/updated via import or CRUD has a `core_audit_log` row with before/after; soft-delete only; an asset's detail view shows its provenance (session, file, row, actor).
15. Full-sync preview mode flags register assets absent from the file for review and never archives them automatically.

---

## 8. Success metrics

| Metric | Target |
|---|---|
| Time to first 1,000 committed assets, self-serve (no FMIQ support touch) | < 30 min |
| Import completion rate (sessions reaching commit / sessions reaching mapping) | ≥ 70 percent (OneSchema reported +50 percent activation from in-grid error fixing alone — Research §1.2) |
| Columns auto-mapped correctly on unseen conventional files | ≥ 80 percent |
| Excel round-trips per completed import | 0 median |
| Duplicate assets discovered post-commit (first 90 days) | < 1 percent of imported rows |
| Sessions undone for data quality reasons | < 5 percent |
| Support hours per tenant onboarding | < 2 (vs consultant-led migration as the incumbent baseline — Research §2.1) |

Instrument: stage funnel events per session, mapping-acceptance vs override rates, autofix usage, undo usage.

---

## 9. Phasing

### Sprint-1 slice (aligns with PROJECT-PLAN EP-1)

1. **Migration 002** — full D1–D4 schema (cheap to land at once; avoids re-migration), RLS, indexes.
2. **Register v1** — list/search/filter, location tree, asset detail with provenance panel, CRUD with audit + soft delete, Excel export.
3. **Import wizard, narrow path:** single-sheet CSV/XLSX, create-only mode. Stages: upload → header detection (junk rows, no two-row merge yet) → mapping with exact + fuzzy + remembered (no AI), confidence + provenance badges → value mapping for condition + criticality → server-side validation with fix-in-grid (filter-to-errors, inline edit, exclude row; no bulk find-replace/autofix yet) → hierarchy resolution with explicit link-vs-create confirm → exact-key dedupe (tag/serial; skip or create-anyway) → dry-run counts → transactional commit with `imp_change` ledger + create-only undo → import history list.

This slice already clears AC3, AC6, AC10, AC13–15 and most of AC1, and is sufficient to seed the NMI demo estate via the product instead of SQL (OUTSTANDING 1.9).

### Sprint 2–3

Multi-sheet union + sheet classification; merged-cell forward-fill; two-row headers; autofix library (dates, units, sentinels) + bulk find-replace; annotated Excel error export + correction re-merge; quantity-row explode; fuzzy dedupe with field-level merge; upsert mode + scoped-field re-import; full undo for updates; AI mapping/value suggestions behind a flag; dry-run Excel report.

### Later (Phase 2 alignment)

COBie profile (feeds Handover Gate); system hierarchy UI; SFG20/Uniclass code validation against reference data; 50k-row performance hardening + resumable background jobs; self-validating template generator; onboarding-support observer session links; full-sync preview mode.

---

**END — v0.1 — 2026-06-11**
