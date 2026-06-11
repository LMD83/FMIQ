# Sprint F1 — Front-end split change log

**Date:** 2026-06-11 · **Scope:** `app/packages/web` · **Task:** split monolithic `App.tsx` into a routed application + register browse v1

## New dependency

- `react-router-dom ^6.30.0` added to `packages/web/package.json` (run `npm install` from `app/`). All other UI deps were already hoisted at the workspace root.

## Files added

| File | Purpose |
|---|---|
| `src/nav.ts` | Single source of truth: nav id ↔ label ↔ group ↔ route path; `activeNavId()` longest-prefix resolver |
| `src/hooks/usePortfolio.ts` | Shared react-query read hooks (zones, work orders, summary, sites, obligations, projects, reading trend) |
| `src/components/Chip.tsx` | `Chip` + `ragChip` extracted from App.tsx (icon+text status, WCAG 1.4.1) |
| `src/pages/collection-care/CommandCentrePage.tsx` | Former `command` view — hero loop, simulate/acknowledge, Trend SVG, zones grid |
| `src/pages/dashboard/EstateDashboardPage.tsx` | Former `dashboard` view — KPIs + status bars |
| `src/pages/work-orders/WorkOrdersPage.tsx` | Former `maintenance` view — work-order table |
| `src/pages/compliance/CompliancePage.tsx` | Former `compliance` view — obligations register |
| `src/pages/projects/ProjectsPage.tsx` | Former `projects` view — CWMF capital projects |
| `src/pages/sustainability/SustainabilityPage.tsx` | Former `sustain` view — Bizot KPIs |
| `src/pages/platform/IntegrationsPage.tsx` | Former `integrations` view |
| `src/pages/platform/ReportsPage.tsx` | Former `reports` view |
| `src/pages/platform/SettingsPage.tsx` | New trivial placeholder (identity mode, language, residency) for nav completeness |
| `src/pages/assets/useEstate.ts` | `useEstateTree` / `useAssets` / `useAsset` hooks + condition/criticality tone maps |
| `src/pages/assets/EstateTree.tsx` | Keyboard-operable hierarchy tree (site > building > floor > space) |
| `src/pages/assets/AssetsPage.tsx` | Register browse v1 — tree + breadcrumb + searchable/filterable table (condition A–D, criticality, type) |
| `src/pages/assets/AssetDetailPage.tsx` | Asset detail — identity, condition, criticality, location, lifecycle panels |
| `src/pages/assets/AssetImportPage.tsx` | Import wizard placeholder (Sprint F2; PRD §4.1 stage list) |

## Files edited

- `src/App.tsx` — rewritten as thin router + shell layout (~100 lines, was 443). `BrowserRouter` > `ShellLayout` (AppShell + `Outlet`) > routes. Former `estate` view's site cards are superseded by the register tree (site nodes carry county/heritage/buildings/zones meta).
- `src/components/shell/AppShell.tsx` — added `settings` icon to ICONS map (2-line change; component API untouched).
- `package.json` — react-router-dom dependency.

## Route map

`/` → redirect `/collection-care` · `/collection-care` (command) · `/roles` · `/dashboard` · `/floor-map` · `/helpdesk` · `/work-orders` · `/ppm` · `/field` · `/compliance` · `/certificates` · `/assets` (+ `/assets/import`, `/assets/:id`) · `/inventory` · `/approvals` · `/projects` · `/sustainability` · `/contractors` · `/documents` · `/evidence` · `/integrations` · `/reports` · `/settings` · `*` → redirect. Pre-existing `views/*` are routed unchanged (QR capture lives in `/field`).

## Design tokens

No new token file — existing system reused: `index.css` (Lumen tokens, Tailwind v4 `@theme`) + `theme.css` (legacy CSS variables). No emoji, no gradients added.

## TODO-API list

1. `GET /api/v1/estate/tree` — full site>building>floor>space tree with asset counts (`useEstate.ts`). Falls back to site-level nodes from `/api/v1/sites` until built.
2. Server-side full-text asset search incl. tag/serial/model once migration 002 columns land (`AssetsPage.tsx`).
3. Location-chain expansion on `GET /api/v1/assets/:id` (`AssetDetailPage.tsx`) — detail currently shows the space name from the list payload.
4. `GET /api/v1/assets/:id/audit` + linked WO/PPM stubs for the detail history panel (`AssetDetailPage.tsx`).
5. `imp_*` import-session endpoints (`AssetImportPage.tsx`, Sprint F2).
6. Condition survey date / lifecycle fields on detail — blocked on migration 002 (`AssetDetailPage.tsx`).

## Verification notes (static — builds not runnable in this session)

- Every import in every new/edited file checked against the exporting module (`api.ts`, `StatusBadge`, `format.ts`, `i18n.tsx`, `authConfig.ts`); no `React.` namespace usage without import; no duplicate identifiers; route paths consistent between `nav.ts` and `App.tsx`.
- `react-router-dom` is the only new package — **`npm install` + `npm run typecheck` + `npm run build` must be run before merge** (broken bash mount prevented running them here).
- E2E (`app/e2e/*.spec.ts`) drives nav by clicking sidebar buttons and asserting text — compatible: buttons remain, `/` redirects to the command centre. URLs now change on nav (new capability, asserted nowhere).
- Asset-table filtering by site/building/floor is client-visible but inert until TODO-API 1 lands (only `spaceId` is filterable server-side); the UI states this explicitly when a non-space node is selected.
- Risk: query keys are shared between pages and pre-existing views (`zones`, `projects`, `work-orders`) — fetchers are identical so cache sharing is intentional, but keep them in sync if endpoints diverge.

## F2 wizard

**Date:** 2026-06-11 · **Scope:** `app/packages/web` · **Task:** wire /assets to the F1 API + build the 8-step import wizard. Clears FE TODO-API items 1–6 (1–4 via the real endpoints; 5 via the wizard; 6 ships with the new detail fields).

### Files added (all under `src/pages/assets/import/`)

| File | Purpose |
|---|---|
| `importApi.ts` | Typed client for every `routes/imports.ts` endpoint (shapes mirrored exactly: snake_case reads, camelCase writes); client-side mirror of `importEngine.TARGET_FIELDS` (**keep in sync**); enum value-map suggestion heuristics; base64 helper |
| `common.tsx` | `Stepper` (back-nav only; forward = each step's primary action), `StepShell`, `ConfidenceBadge` (confidence + exact/remembered/fuzzy/manual provenance), `CountPills`, session status badge |
| `UploadStep.tsx` | Step 1 — drag-drop/picker (.xlsx/.xls/.csv/.tsv, 50 MB/50k-row copy), base64 `POST /api/v1/imports`; `ImportHistory` dashboard (AC10) with Resume / View-assets / undo-deadline |
| `MappingStep.tsx` | Step 2 — per-column target select with sample values (first 5 rows), confidence+provenance badges, explicit "Not imported", duplicate-target block, required gate (name + site/building) |
| `ValueMapStep.tsx` | Step 3 — distinct values for condition/criticality columns (sampled from first 1,000 rows), suggested/saved/manual provenance, "blank" vs "leave unmapped (warning)" distinction |
| `ValidationStep.tsx` | Step 4 — auto-runs `POST /validate`; counts pills; filter-to-state; paginated grid; click/Enter-to-edit cells (`PATCH /rows` re-validates server-side); exclude + restore (empty-raw patch); continue blocked while errors > 0 |
| `HierarchyStep.tsx` | Step 5 — `POST /hierarchy/resolve` on entry; link-vs-create per site/building/floor/space with candidates from the locations tree; single confirm-all PUT; Level-0 / space-type notes surfaced |
| `DedupeStep.tsx` | Step 6 — `POST /dedupe` + `GET /duplicates` joined on rowId; group key/kind badges, links to matched register assets, keep/skip per row (`PUT /duplicates/resolutions`) |
| `CommitSteps.tsx` | Steps 7–8 — `POST /dry-run` (same-gate counts, AC3), new-entity confirm list, client-side CSV sign-off download; commit with status-driven result view, "View imported assets" link (`/assets?importSession=`), undo with 7-day note, restart |

### Files edited

- `api.ts` — `ApiError` (carries server `{error, message}` so 409 gate messages surface verbatim); `Asset` extended to the migration-022 column set; `listAssets(filter)` → `{assets, total}` with full q/filter/pagination; `getAsset` → `{asset, provenance, audit}`; `AssetWriteInput` (camelCase) for create/patch; 204 handling.
- `pages/assets/useEstate.ts` — tree now `GET /api/v1/locations/tree` (typed, mapped to `EstateNode`); `useAssets(filter)` server-side with `keepPreviousData`; `useAssetDetail`; `locationChain()` resolves the full site/building/floor/space breadcrumb from the cached tree (closes TODO-API 3 client-side).
- `pages/assets/AssetsPage.tsx` — debounced server-side search (name/code/tag/serial/manufacturer/model), condition/criticality/type filters, tree-scoped site/building/space filters (floor approximates to its building — no server floor filter), 50-row pagination with totals, `?importSession=` filter banner, auth-aware CSV export.
- `pages/assets/AssetDetailPage.tsx` — full detail (`{asset, provenance, audit}`): identity/classification/lifecycle panels incl. tag, serial, model, Uniclass, SFG20, expected life, replacement cost (EUR), warranty; provenance panel (file, row, actor, committed, session link); audit-history table.
- `pages/assets/AssetImportPage.tsx` — placeholder replaced by the wizard orchestrator: `?session=<id>&step=<n>` in the URL (resume on reload, AC9), resume step derived from server `status`, forward jumps clamped by `maxStepFor(status/rowCounts)`, committed/undone sessions lock to the result step; `committing` polls at 2 s.

### State machine (no dead ends)

Upload → Map → Values → Validate → Hierarchy → Dedupe → Dry-run → Commit. Back is always available pre-commit; going back is safe because each forward action re-runs its server stage (`validate`/`resolve`/`dedupe`/`dry-run` are idempotent and preserve user decisions). Continue gates: Map needs name + location anchor and no duplicate targets; Validate needs error count 0; Hierarchy confirms all decisions in the continue action; Commit is enabled only when `status === 'dry_run'` with 0 blocked errors (server re-enforces all gates; `ApiError` surfaces its 409 reasons).

### Adaptations to BE as implemented (vs PRD §6)

- Upload is JSON+base64 (not multipart), `targetMode` create-only, single data sheet — per BE Sprint-1 slice.
- Dedupe resolutions are keep/skip only (no field-level merge — Sprint 2); "merge" intentionally not offered in the UI.
- Dry-run sign-off download is a client-generated CSV (`GET .../dry-run.xlsx` does not exist yet).
- Value-map suggestions are client-side heuristics (1–5/Good-Fair-Poor → A–D, RAG → tiers); server stores only confirmed maps.
- Floor-level register filtering approximates to the parent building (list API filters by site/building/space only).

### Verification notes (static — builds not runnable in this session)

- Every endpoint call re-checked against `routes/imports.ts` + `routes/assets.ts` zod schemas and `domain/imports.ts`/`domain/assets.ts` SELECTs (incl. `min(1)` guards: empty entity-decision PUT is skipped; pg `numeric` confidence handled as string-or-number).
- All files < 500 lines; no emoji; existing tokens/classes only (`panel`, `btn`, `banner`, `status-badge`, theme.css vars).
- **Must run before merge:** `npm install && npm run typecheck && npm run build` in `app/` (broken bash mount prevented running them here).
- Residual risks: `TARGET_FIELDS` mirror can drift from `importEngine.ts` (add a shared package or contract test); value-map distinct values sample the first 1,000 staged rows (flagged in the UI with "+"); dedupe group metadata joins POST groups to GET rows by rowId — a row in two key-groups shows the last-assigned group's key.
