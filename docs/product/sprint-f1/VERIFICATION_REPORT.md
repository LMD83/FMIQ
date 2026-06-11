# Sprint F1 — Independent Verification Report

Version: v1.0 | Generated: 2026-06-11 | Reviewer: independent static review (adversarial)
Scope: FE split (routed pages), migration 022 + register/import API + importEngine, 8-step import wizard.
Method: static only — bash mount broken below `app/`; every file read with Read/Grep/Glob. **No build, typecheck, test or DB run was possible in this session — the runbook below is mandatory before merge.**

---

## 1. Findings table

| # | Severity | File(s) | Issue | Status |
|---|---|---|---|---|
| F1 | **BLOCK** | `app\packages\api\src\domain\imports.ts` (`setMappings`, `setValueMaps`), `app\packages\web\src\pages\assets\import\ValidationStep.tsx` | **Stale normalised data after back-nav edits.** `setMappings`/`setValueMaps` neither reset row states to `pending` nor regress session status. ValidationStep auto-runs validation only when `pending > 0` (or zero counts). Path to bad data: reach Dry-run → Back to step 2/3 → change a column or value mapping → Confirm → step 4 shows the OLD all-valid counts (no auto re-run) → Hierarchy/Dedupe/Dry-run/Commit all re-run and succeed → **committed assets carry values normalised under the superseded mappings**. The FE changelog's claim "going back is safe because each forward action re-runs its server stage" is false for the validate stage. Recommended fix (server): in `setMappings` and `setValueMaps`, `UPDATE imp_row SET state='pending', normalised=NULL, issues=NULL WHERE session_id=$1 AND state <> 'excluded'` and `UPDATE imp_session SET status='mapping', current_stage=2`. The existing UI then does the right thing for free (`pending>0` triggers auto-validate; `maxStepFor('mapping')=4` clamps forward jumps). | **FIXED 2026-06-11** — recommended server fix applied verbatim in `setMappings` and `setValueMaps` (rows reset to `pending`, session regressed to `mapping`/stage 2); re-verify via runbook step 4 (back-nav edit re-triggers validation) |
| F2 | WARN | `app\packages\api\src\domain\imports.ts` (765 lines), `app\packages\api\src\domain\importEngine.ts` (617 lines) | Two new backend files exceed the 500-line convention. Natural split: move commit/undo out of `imports.ts` (`importCommit.ts`); move parse/validate helpers out of `importEngine.ts`. | OPEN |
| F3 | WARN | `app\packages\api\src\routes\portfolio.ts`, `app\packages\api\src\domain\issueCapture.ts`, `lifecycle.ts`, `predictive.ts` | **Soft-delete blind spots.** Migration 022 adds `deleted_at` to `est_asset`/`est_site`/`est_building`/`est_floor`/`est_space`, and import-undo soft-deletes through it — but pre-existing modules query those tables with no `deleted_at IS NULL` filter (`/api/v1/sites`, `/api/v1/summary`, QR resolve in issueCapture, lifecycle forecast, predictive). An undone import leaves ghost sites/buildings/assets visible in those views while the register correctly hides them. | OPEN — cross-module sweep needed |
| F4 | WARN | `app\packages\web\src\pages\assets\import\MappingStep.tsx` + `imports.ts setMappings` | "Confirm mappings" PUTs **every** column (changed or not); the server stamps all of them `provenance='manual', confidence=1`. The exact/remembered/fuzzy provenance trail (PRD AC2) is destroyed on first confirm — re-entering step 2 shows everything as "Manual 100%". Send only changed columns, or have the server skip no-op updates. | OPEN |
| F5 | WARN | `app\packages\api\src\routes\imports.ts` + `domain\imports.ts` | **Loose server-side state machine.** `validate`, `hierarchy/resolve`, `dedupe` and `dry-run` POSTs are not gated on the preceding stage; only commit checks `status === 'dry_run'`. An API caller can dry-run/commit a never-validated session (all rows `pending` → 0 created, no error). The UI enforces order; the API does not. Defence-in-depth gap, not exploitable for bad data (pending rows never commit). | OPEN |
| F6 | WARN | `app\packages\api\src\domain\imports.ts` (`runDedupe`), changelog-acknowledged | A row that matches two key groups (asset-tag group AND serial+model group) gets its `dedupe_group_id` overwritten by the last group processed; the GET `/duplicates` view then shows it only under that group and the other group renders incomplete. Flagged in the BE/FE changelogs; acceptable for Sprint 1, fix with a row↔group join table in Sprint 2. | OPEN (known) |
| F7 | WARN | `app\packages\api\src\routes\assets.ts`, `routes\imports.ts` | `:id` path params are not validated as UUIDs; a malformed id reaches `pg` and throws `22P02` → 500 instead of 404. Pre-existing repo-wide pattern (zod is used for bodies/queries only). | OPEN (pre-existing pattern) |
| F8 | INFO | `app\packages\api\src\db\withTenant.ts`, `CommitSteps.tsx`, `AssetImportPage.tsx` | `status='committing'` is written inside the single commit transaction, so it is never observable from another connection — the 2 s poll for `committing` is effectively dead code. Harmless; a mid-commit failure correctly rolls back to `dry_run` (no stuck sessions). | OPEN (no action needed) |
| F9 | INFO | `app\packages\web\src\pages\assets\import\importApi.ts` | FE `SessionStatus` omits `draft`/`parsing`/`abandoned` (allowed by the DB CHECK, never emitted on the Sprint-1 path). `TARGET_FIELDS` is a hand-maintained mirror of `importEngine.TARGET_FIELDS` — add a contract test or shared package before they drift. | OPEN |
| F10 | INFO | `app\packages\web\src\pages\assets\import\HierarchyStep.tsx` | Link candidates are not scoped to the chosen parent (every floor in the estate is offered for any inbound floor). Labels carry the full path so it is visible, and `setEntityDecisions` does not validate parentage server-side. User-error risk only. | OPEN |
| F11 | INFO | `app\packages\web\src\pages\collection-care\CommandCentrePage.tsx:122` | `⚠` glyph in the excursion pulse — carried over verbatim from the old App.tsx (pre-existing, internal UI; brand emoji rule targets external deliverables). | OPEN (pre-existing) |
| F12 | INFO | `app\packages\api\scripts\db-up.mjs` | Migration runner is non-idempotent (applies every `.dev.sql` unconditionally) — `npm run db:up` against an already-migrated DB fails at 001. Use `npm run db:reset` to pick up migration 022 on an existing local DB. | OPEN (dev-tooling) |

### Verified clean (adversarial checks that passed)

- **FE↔BE contract** — every `importApi.ts` call (method, path, body, response shape) matches `routes/imports.ts` zod schemas and the `domain/imports.ts` SELECT/RETURN shapes, including wrapper keys (`{session}`, `{mappings}`, `{counts}`, `{dryRun}` vs unwrapped commit/undo/patch results), snake_case reads vs camelCase writes, pg-numeric `string|number` tolerance, and the POST-`/dedupe`-vs-GET-`/duplicates` shape split. Same for `api.ts` ↔ `routes/assets.ts` (`{assets,total}`, `{asset,provenance,audit}`, `{sites}` tree, 204 delete, `export.csv` via `apiText`). **No mismatches found.**
- **Router integrity** — all 21 `nav.ts` paths exist in `App.tsx`; all 12 page + 11 view imports resolve to real files; `/assets/import` + `/assets/:id` ordered correctly (static beats param in v6 ranking); `*` fallback present; `activeNavId` longest-prefix maps `/assets/import` → `estate`; `settings: Settings` icon present in `AppShell` ICONS with the lucide import.
- **Migration 022** — prod/dev variants in sync (only the documented tenant-index shape differs); RLS block is byte-for-byte the 001 pattern (ENABLE+FORCE+`tenant_isolation`+grants); no duplicate column adds vs 001 (`install_date`) or 016 (`replacement_cost`, `condition_survey_date`, `design_life_years`); all FK targets exist (`core_tenant`, `core_user`, `est_building`, `imp_session` self-ordered correctly — FK added after table); `criticality` CHECK is `NOT VALID` and seed values (`high`/`medium`) and the COBie insert path (no criticality column) survive it; the remaining seed `'med'` is `cc_object_link.sensitivity` — different table, unaffected; `imp_change` REVOKE mirrors `core_audit_log`.
- **importEngine purity** — no DB, no `Date.now()`, no clock anywhere (routes inject `todayIso()`); `willCommitRow` is genuinely shared by `computeDryRun` and the commit loop (counts parity holds, including `pending` → skipped on both sides); test file imports exactly match exports; undo's `updated_at <= committed_at` guard is sound because both stamps are the same `now()` transaction timestamp.
- **Conventions** — global `onRequest` auth hook covers every `/api/` route; all import/asset writes carry `requireRole(FacilitiesManager|TenantAdmin|SystemAdmin)`; every write audits to `core_audit_log`; no hard deletes (asset delete is `deleted_at`; `imp_change` append-only); tenant scoping via `withTenant` SET LOCAL + RLS on every new table; all FE files < 300 lines; dev auth bypass (`DEV_NO_AUTH=true`) grants FacilitiesManager and `devUserId` exists in seed (FK-safe).
- **Wizard state machine** — no dead ends: locked statuses (`committing/committed/undone`) force the result step; resume restores from `?session=` + server status; commit 409s surface verbatim via `ApiError` and roll back to `dry_run`; undo gated by window client- and server-side; forward jumps clamped by `maxStepFor`. The one machine defect is F1 above.

## 2. Fixes applied by the reviewer

**None.** No unambiguous mechanical defects (typos, wrong import paths, mismatched field names) were found — the cross-agent contract discipline held. All findings above are open and listed with recommended fixes; F1 needs a deliberate (small) server change and should land before this sprint merges.

## 3. Local verification runbook (Windows PowerShell 5.x — run each line separately, no `&&`)

```powershell
cd C:\Users\gavin\CODE\FMIQ\app
npm install
npm run db:reset
npm run typecheck
npm run test
npm run build
npm run dev
```

Notes:
- `npm install` is required — `react-router-dom`, `papaparse`, `xlsx`, `@types/papaparse` are declared but not installed.
- `npm run db:reset` (not `db:up`) if a local DB already exists — the migration runner is not idempotent (F12). First-ever setup: `npm run db:up`.
- `npm run test` runs the api vitest suite incl. `importEngine.test.ts`.
- `npm run dev` starts API on :8080 and web on :3001 (vite proxies `/api`). DEV_NO_AUTH defaults true with FacilitiesManager — wizard writes work locally.
- Expected gate results: typecheck exit 0, all vitest suites green, both workspace builds green.

## 4. Manual walkthrough — import wizard exit test

Save the block below as `C:\temp\fmiq-sample-import.csv` (15 data rows; deliberately messy):

```csv
Plant & Asset Survey 2026 - Collins Barracks and environs,,,,,,,,,,,,,
,,,,,,,,,,,,,
Asset Description,Tag No,Serial Number,Make,Model No,Equipment Type,Conditon Rating,Priority,Date Installed,Replacement Value,Site,Building,Level,Room
Air handling unit - Mammal Hall,TAG-0041,SN-77812,Trane,CLCH-04,HVAC,2,High,04/03/2019,"€42,000",Collins Barracks,Riding School,Level 1,Plant Room 1
Circulation pump - heating primary,TAG-0042,SN-90211,Grundfos,MAGNA3,HVAC,3,Medium,12/06/2017,"€3,500",Collins Barracks,Riding School,Level 0,Plant Room 1
Gas boiler No.1,TAG-0043,SN-55410,Vaillant,ecoTEC,HVAC,Good,Red,2015-09-01,"€18,000",Collins Barracks,Riding School,Level 0,Boiler House
Fire alarm panel - east wing,TAG-0044,SN-23401,Kentec,Syncro AS,Life safety,1,Critical,23/11/2021,"€6,200",Collins Barracks,Riding School,Level 1,Riser E1
,TAG-0045,SN-11209,Otis,Gen2,Lift,2,High,15/02/2018,"€95,000",Collins Barracks,Riding School,Level 0,Lift Lobby
Emergency lighting circuit C4,TAG-0046,N/A,Hochiki,FireScape,Life safety,OK,Low,30/04/2020,TBC,Collins Barracks,Riding School,Level 2,Corridor C4
Distribution board DB-RS-02,TAG-0042,SN-66102,Schneider,Acti9,Electrical,3,Medium,09/10/2016,"€2,100",Collins Barracks,Riding School,Level 2,Switch Room
Dehumidifier - textile store,TAG-0047,SN-90211,Munters,MAGNA3,HVAC,2,High,18/01/2022,"€7,400",Collins Barracks,Riding School,,Textile Store
CCTV NVR rack,TAG-0048,SN-44781,Hikvision,DS-9664,Security,2,Medium,02/08/2023,"€4,800",Collins Barracks,Clarke Square Block,Level 1,Control Room
Roof access ladder - north,TAG-0049,SN-31002,Zarges,Z600,Access,4,Low,2030-01-01,"€1,900",Collins Barracks,Clarke Square Block,Level 3,Roof Hatch N
Water booster set,TAG-0050,SN-72190,Wilo,SiBoost,Plumbing,3,Amber,07/07/2014,"450 kW",Collins Barracks,Clarke Square Block,Level 0,Pump Room
AHU - conservation lab,TAG-0051,SN-88123,Daikin,D-AHU05,HVAC,5,Essential,28/02/2024,"€51,000",Collins Barracks,Clarke Square Block,Level 1,Conservation Lab
Heritage clock mechanism,TAG-0052,SN-19077,Smith of Derby,-,Specialist,2,High,11/12/2012,"€12,500 approx",Collins Barracks,Clarke Square Block,Level 2,Clock Tower
Sump pump - basement,TAG-0053,SN-60455,KSB,Ama-Drainer,Plumbing,3,Medium,21/05/2019,"€1,200",,Riding School,Level 0,Basement Sump
Generator - standby diesel,TAG-0054,SN-50997,FG Wilson,P150,Electrical,2,Critical,16/03/2020,"€38,000",Collins Barracks,Riding School,Level 0,Generator House
```

What the file deliberately exercises: junk title + blank row above the header (header-row detection); synonym/typo headers incl. `Conditon Rating` (fuzzy), `Tag No`, `Make`, `Priority`, `Date Installed`, `Replacement Value` (exact-synonym); 1–5 + `Good`/`OK` condition values (value mapping; `OK` has no suggestion → warning); RAG/words criticality (`Red`, `Amber`, `Essential`); a blank Asset Description (row 5 — required-field error); a future install date 2030 (error); duplicate `TAG-0042` pair (dedupe, within-file); duplicate serial+model `SN-90211`/`MAGNA3` pair (second dedupe key); a space with no floor (Level-0 placeholder); a row with building but no site; sentinels `N/A`/`TBC`; unit-suffixed and currency numbers; two new buildings under a (likely linkable) `Collins Barracks` site.

Ten-step script (web app at http://localhost:3001):

1. **Enter** — sidebar → Estate & Assets → "Import register" (URL `/assets/import`). Confirm the empty Import history panel renders.
2. **Upload (step 1)** — drag the CSV in. Expect: parse succeeds, lands on step 2 with `?session=<id>&step=2` in the URL; hint shows header detected on row 3 and ~15 data rows.
3. **Map columns (step 2)** — verify `Conditon Rating` mapped to Condition grade with a "Fuzzy" badge < 100%, `Tag No`/`Make`/`Priority`/`Date Installed`/`Replacement Value` mapped with "Exact match", and no column silently unmapped. Set one column to "Not imported" and back. Confirm mappings.
4. **Map values (step 3)** — condition rows for `1,2,3,4,5,Good,OK` and criticality rows for `Red,Amber,Essential,...` appear with counts. `Good`→A and `Red`→critical pre-suggested; map `5`→D; leave `OK` unmapped (note the "will become row warnings" message). Confirm.
5. **Validate (step 4)** — auto-runs; expect errors > 0 (blank name row, 2030 install date) and the grid pre-filtered to errors; warnings for `N/A`/`TBC` sentinels, `OK` unmapped value, `450 kW` / `approx` unit-strips. Click the blank name cell, type `Passenger lift - east`, Enter (row revalidates to valid/warning). Fix the 2030 date to `16/01/2020` — or click Exclude on that row and then Restore and fix it, to test both paths. Continue only enables at 0 errors.
6. **Hierarchy (step 5)** — expect site `Collins Barracks` suggested as **Link** (seed match), buildings `Riding School` + `Clarke Square Block` as **New**, the floorless Textile Store space sitting under a "Level 0" placeholder, and the siteless row 15 anchored via its building. Re-point one floor decision Link↔Create and back. Confirm all.
7. **Dedupe (step 6)** — expect 2 groups: `TAG-0042` (asset tag, within-file) and `SN-90211 + MAGNA3` (serial+model). Defaults: first occurrence Keep, second Skip. Flip one to Keep and back to Skip. Continue.
8. **Dry-run (step 7)** — verify counts reconcile: creates + skipped duplicates + excluded = 15 (minus nothing; errors must be 0), new locations list names both new buildings, every floor and space, and the Level 0 placeholder. Download the CSV summary. **Refresh the browser here** — the wizard must resume at step 7 with identical numbers (AC9).
9. **Commit (step 8)** — Commit; expect created == dry-run creates and locations == dry-run new-locations (AC3 parity). Click "View imported assets" → `/assets?importSession=<id>` shows exactly the created rows; open one asset → Provenance panel shows file, row, actor, session link; Audit history shows "Created by import".
10. **Undo + exit** — back on `/assets/import`, history row shows Committed with an undo deadline. Edit ONE imported asset first (PATCH via UI/API) if you want to verify `skippedEdited`, then "Undo this import": expect reverted = created − edited, locations reverted only where empty, register no longer lists the assets, and (known gap F3) the ghost buildings may still appear in legacy views like the floor map — that is expected until F3 is fixed.

---

**END — v1.0 — 2026-06-11**
