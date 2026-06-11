# Sprint F1 — Backend change log (asset register + import)

Version: v1.0 | Generated: 2026-06-11 | Owner: Nexum Intelligence Systems Limited
Source PRD: `docs/product/PRD-asset-register-import.md` (§5 data model, §6 API, §9 Sprint-1 slice)

## Migration

**`022_asset_register_import.sql` + `022_asset_register_import.dev.sql`** (next after 021; additive only; both kept in sync per repo convention; RLS ENABLE+FORCE + `tenant_isolation` policy + tenant index on every new table; prod grants to `fmiq_app`).

- **`est_asset` deltas (ALTER):** `model`, `serial_no`, `asset_tag`, `uniclass_code`, `sfg20_ref`, `expected_life_years`, `warranty_expiry`, `building_id` (FK `est_building`, levels-optional anchor), `import_session_id` (FK `imp_session`, added after that table), `source_row`, `created_at`, `updated_at`, `deleted_at` (soft delete). NOT re-added (already exist): `install_date` (001), `replacement_cost` / `condition_survey_date` / `design_life_years` (016). `expected_life_years` coexists with 016's `design_life_years` (design intent vs surveyor expectation).
- **Criticality constrained:** `CHECK (criticality IN ('critical','high','medium','low')) NOT VALID` — existing rows unvalidated; new writes checked. Run `VALIDATE CONSTRAINT` after backfill. `condition_grade` was already A–D (001). Seed data normalised: two `'med'` values → `'medium'` (seed re-runs after migrations; `'med'` would violate the new CHECK).
- **PRD-D1 anchor CHECK deliberately omitted** — NOT VALID checks still apply to new inserts and the existing COBie path (`domain/handover.ts importCobie`) inserts unanchored assets. Documented in the migration.
- **Timestamps + soft delete added to `est_site` / `est_building` / `est_floor` / `est_space`** (PRD §5.1 known drift; required for create-only undo).
- **New tables:** `est_system`, `est_asset_system` (D2); `est_attribute_def`, `est_asset_attribute` (D3); `imp_session`, `imp_file`, `imp_sheet`, `imp_mapping`, `imp_value_map`, `imp_row`, `imp_entity_decision`, `imp_change` (append-only — UPDATE/DELETE revoked from `fmiq_app` in prod), `imp_mapping_memory` (D4).
- **Indexes:** dedupe keys `(tenant_id, asset_tag)`, `(tenant_id, serial_no, model)`, provenance `(tenant_id, import_session_id)`, `(tenant_id, building_id)`, `imp_row (tenant_id, session_id, state)`, `imp_change (tenant_id, session_id)`.

## API endpoints (all under existing auth hook; writes `FacilitiesManager|TenantAdmin|SystemAdmin`; tenant-scoped via `withTenant`/RLS; all writes audited to `core_audit_log`; no hard deletes)

**Register (`src/routes/assets.ts`, rewritten):**
- `GET /api/v1/assets` — q-search (name/code/tag/serial/manufacturer/model) + filters (space/building/site/type/condition/criticality/importSessionId) + limit/offset + total
- `GET /api/v1/assets/export.csv` — filtered CSV export (same filters)
- `GET /api/v1/locations/tree` — Site→Building→Floor→Space with asset counts
- `GET /api/v1/assets/:id` — detail incl. provenance panel (session/file/row/actor) + audit history
- `GET /api/v1/assets/:id/children`, `GET /api/v1/assets/:id/qr` (existing, kept)
- `POST /api/v1/assets`, `PATCH /api/v1/assets/:id` — extended field set
- `DELETE /api/v1/assets/:id` — soft delete (`deleted_at`), audited

**Import wizard (`src/routes/imports.ts`, new — create-only Sprint-1 path):**
- `POST /api/v1/imports` — upload (JSON `{filename, contentBase64, targetMode}`; route bodyLimit 75 MB; 50 MB / 50k-row ceilings) → parse + header detect + auto-map
- `GET /api/v1/imports`, `GET /api/v1/imports/:id` — history / session state (resumable)
- `GET|PUT /api/v1/imports/:id/mappings` — exact > remembered (imp_mapping_memory) > fuzzy, confidence + provenance, no AI
- `GET|PUT /api/v1/imports/:id/value-maps` — enum maps (condition 1-5/Good-Fair-Poor→A-D, criticality→tiers)
- `POST /api/v1/imports/:id/validate` — errors block / warnings pass; `GET|PATCH /api/v1/imports/:id/rows` — fix-in-grid, exclude
- `POST /api/v1/imports/:id/hierarchy/resolve`, `GET|PUT /api/v1/imports/:id/entity-decisions` — explicit link-vs-create incl. "Level 0" placeholder floor
- `POST /api/v1/imports/:id/dedupe`, `GET /api/v1/imports/:id/duplicates`, `PUT /api/v1/imports/:id/duplicates/resolutions` — exact keys: asset_tag; serial+model; within-file + vs-register
- `POST /api/v1/imports/:id/dry-run` → `POST /api/v1/imports/:id/commit` (transactional; same `willCommitRow` gate so dry-run counts == commit counts; writes `imp_change` + audit + provenance) → `POST /api/v1/imports/:id/undo` (create-only reversal, 7-day window, skips subsequently-edited records, soft-delete only)

## New/changed source files

- `src/domain/importEngine.ts` — NEW, pure (no DB/clock): target-field registry + synonyms, header normalise/fuzzy match, `suggestMappings`, `detectHeaderRow`, `normaliseAndValidate` (sentinels, DD/MM-default + Excel-serial dates, unit-stripping numbers, enum value-maps), `findDuplicates`, `extractHierarchy`/`matchEntity`, `computeDryRun`/`willCommitRow`, `toCsv`, `sourceFingerprint`
- `src/domain/importParse.ts` — NEW: papaparse (CSV/TSV) + SheetJS (XLSX/XLS) → sheet matrices → records
- `src/domain/imports.ts` — NEW: session orchestration (staged rows, mapping memory, validation batches, hierarchy/dedupe persistence, commit/undo ledger)
- `src/domain/assets.ts` — REWRITTEN: new columns, deleted_at filtering everywhere, search/filter/pagination, detail+provenance+audit, soft delete, location tree, CSV export
- `src/routes/assets.ts` — REWRITTEN (above endpoints); `src/routes/imports.ts` — NEW
- `src/server.ts` — registered `importRoutes`
- `db/seed.sql` — criticality `'med'` → `'medium'` (2 rows)

## New dependencies (added to `app/packages/api/package.json` — **not installed**, run `npm install`)

- `papaparse ^5.4.1`, `xlsx ^0.18.5` (deps); `@types/papaparse ^5.3.14` (devDep)

## Tests

- `src/domain/importEngine.test.ts` — NEW (vitest, per `npm test` script): mapping suggestion (exact/remembered/fuzzy/unmapped/duplicate-target demotion), header-row detection, validation rules (required name + location anchor, value maps, unmapped-enum warnings, sentinels, date/number parsing, future-date + negative-cost blocks), dedupe keys (tag; serial+model; within-file/existing/both; blank keys), hierarchy extraction (placeholder floor, building-as-site), entity matching, dry-run diff + commit gate parity, CSV escaping, fingerprint stability. All pure — no DB needed.

## Not verifiable statically / known deviations

- **No build or test run possible** — bash mount broken below `app/`; the local `node_modules` tree is partial (even `pg`/`vitest` not present), so `npm install` then `npm run typecheck && npm test` in `app/packages/api` is required to verify. Migration SQL was desk-checked only (`db:reset`/`db:up` will exercise it).
- Upload is JSON+base64, not multipart (`@fastify/multipart` not in the tree); PRD's multipart upload deferred to Sprint 2. File bytes are not retained (`imp_file.blob_uri` null; staged rows carry the data).
- `GET /assets/:id` response shape changed from `{asset}` to `{asset, provenance, audit}` — front-end (being rebuilt this sprint) must match.
- Spaces created via import default `space_type='office'` (column is NOT NULL CHECK-constrained; survey files rarely carry it). Surfaced in the entity-decision confirm list.
- Undo of created locations only removes entities with no remaining live children; edited assets are skipped and reported (`skippedEdited`).
- Deferred to Sprint 2+ (per PRD §9): multi-sheet union, merged-cell forward-fill, two-row headers, autofix/find-replace, annotated error-file export + re-merge, fuzzy dedupe + field-merge, upsert/full-sync modes, COBie profile via the new session machinery, AI suggestions.

**END — v1.0 — 2026-06-11**
