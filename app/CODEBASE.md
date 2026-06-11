# FMIQ Codebase Navigator

> The complete map of the FMIQ `app/` codebase — file locations, module responsibilities, data flow, conventions, and gotchas. Read this before writing or reviewing FMIQ code, so you use the right table names, never skip RLS isolation, and keep import paths/migrations correct.
>
> **Modelled on** the `goviq-codebase-navigator` (same documentation shape). **But FMIQ is a different stack from GovIQ.** GovIQ is Convex (`convex/schema.ts`, Convex Auth, workpools, crons, `sp_*/gov_*/router_*` tables). FMIQ is **PostgreSQL + RLS + Azure + Fastify** — committed in `docs/architecture-adr.md`, which explicitly rejected Convex for EU data residency. **Do not import GovIQ's Convex conventions here.** Inherit the *governance DNA* (Entra auth, audit-on-every-write, public-sector domain), not the engineering patterns.

_Last updated: 2026-06-06. Status: v0.1 scaffold — the platform spine + collection-care loop are real; all other operations modules are planned (see `docs/FMIQ-master-build-plan.md`)._

---

## 1. Stack & deployment

| Property | Value |
|---|---|
| Repo layout | npm **workspaces** monorepo: `packages/api`, `packages/web`, `infra/` |
| Runtime | Node **≥20**, **ESM** (`"type":"module"`) — TS compiled NodeNext |
| API | **Fastify 4** + TypeScript · `pg` (node-postgres) · `zod` (validation) · `jose` (JWT) |
| DB | **PostgreSQL 16** + **TimescaleDB** + **PostGIS** + pgcrypto (+ pgaudit in Azure) |
| Auth | **Azure Entra ID** — JWT bearer (API) · `@azure/msal-browser` (SPA) |
| Web | **React + Vite** + MSAL · single-bundle SPA |
| Infra | **Azure Bicep** (`infra/main.bicep`) — Postgres Flexible Server (North Europe), Key Vault |
| Local dev | **embedded-postgres** (in-process) via `scripts/dev.mjs` — `npm run dev` runs PG + API + web |

**Production target (per ADR):** Azure Container Apps (API) + Static Web Apps (SPA) + Postgres Flexible Server (North Europe / Ireland, EU Data Boundary) + Service Bus + Blob + Key Vault, all behind Private Link. The committed code is the spine; Azure wiring beyond `main.bicep` and the eventing/worker tier are not built yet.

---

## 2. Directory map

```
app/
├── package.json            workspaces + root scripts (dev, db:*, build, typecheck)
├── scripts/dev.mjs         one-command dev: embedded Postgres + API + web
├── infra/main.bicep        Azure infra skeleton (Postgres NE, Key Vault, extensions)
├── packages/
│   ├── api/                Node + Fastify + TS API  (the system of record)
│   │   ├── db/
│   │   │   ├── migrations/001_init.sql       Postgres schema (RLS + TimescaleDB) — PROD
│   │   │   ├── migrations/001_init.dev.sql   dev variant (embedded-postgres)
│   │   │   └── seed.sql                       NMI demo dataset (4 sites, zones, sensors…)
│   │   ├── scripts/*.mjs   db lifecycle: start/ensure/setup/bootstrap/db-up/reset
│   │   └── src/
│   │       ├── server.ts          Fastify bootstrap, auth hook, route registration
│   │       ├── config.ts          env config (DATABASE_URL, DEV_NO_AUTH, Entra)
│   │       ├── types.ts           Role union + AuthContext + Fastify req.auth augmentation
│   │       ├── auth/entra.ts      Entra JWT validation + DEV_NO_AUTH bypass
│   │       ├── auth/rbac.ts       requireRole() preHandler factory
│   │       ├── db/pool.ts         pg.Pool singleton
│   │       ├── db/withTenant.ts   ★ RLS-scoped transaction helper (tenant isolation)
│   │       ├── domain/collectionCare.ts   ★ the hero: excursion engine
│   │       ├── adapters/types.ts          SensorAdapter contract + canonicalMetric()
│   │       ├── adapters/conserv.ts        Conserv webhook adapter
│   │       └── routes/  zones · workOrders · ingest · readings · adapters · portfolio
│   └── web/                React + Vite + MSAL SPA
│       └── src/  App.tsx (single ~412-line view) · api.ts (typed client) ·
│                 authConfig.ts (MSAL) · main.tsx · theme.css
```

★ = the two files that define the platform's core patterns; read them first.

---

## 3. Request lifecycle (how a call flows)

```
HTTP → Fastify (server.ts)
  onRequest hook: if url starts with /api/ → authenticate(req)        [auth/entra.ts]
       DEV_NO_AUTH=true → inject {tenantId, userId, roles:[ConservationOfficer,FacilitiesManager]}
       else → verify Entra JWT (JWKS, audience, issuer), map roles claim, tid→tenant, oid→user
  route handler                                                       [routes/*.ts]
       (optional) preHandler: requireRole(...)                        [auth/rbac.ts]
       withTenant(req.auth.tenantId, async client => { ... })         [db/withTenant.ts]
           BEGIN; set_config('app.current_tenant', tenantId, true);
           → all queries run with RLS enforcing tenant_id = app.current_tenant
           COMMIT
  reply.send(...)
```

`req.auth` (type `AuthContext`) is available on every `/api/*` handler — `{ tenantId, userId, email?, roles[] }`.

---

## 4. Module map (`src/`)

### 4.1 `server.ts`
Fastify bootstrap. Registers CORS, a `GET /health` (`{status, service, region}`), the global `onRequest` auth hook (only for `/api/*`), then all route plugins. **To add a module: import its route fn and `await app.register(...)` here.**

### 4.2 `config.ts`
Typed env. Keys: `port` (8080), `databaseUrl` (default `postgresql://fmiq_app:fmiq_app@localhost:5432/fmiq`), `devNoAuth` (**defaults true**), `devTenantId`/`devUserId`, `entra.tenantId`/`entra.audience`. All overridable via `.env` (see `packages/api/.env.example`).

### 4.3 `auth/entra.ts`
`authenticate(req, reply)`. Dev bypass when `DEV_NO_AUTH=true`. Otherwise: `jwtVerify` against Entra JWKS, audience = `entra.audience`, issuer must start `https://login.microsoftonline.com/`, derives `tenantId` from `tid` and `userId` from `oid`/`sub`, maps the `roles` App-Roles claim to FMIQ `Role[]` (defaults `['ReadOnly']`).

### 4.4 `auth/rbac.ts`
`requireRole(...allowed: Role[])` → Fastify preHandler; 403 if `req.auth.roles` intersects none. Roles: `SystemAdmin · TenantAdmin · FacilitiesManager · ConservationOfficer · MaintenanceTech · ReadOnly`.

### 4.5 `db/pool.ts` + `db/withTenant.ts`
`pool` = `pg.Pool` (max 10). **`withTenant(tenantId, fn)` is the only sanctioned way to touch tenant data.** It opens a transaction, sets `app.current_tenant` via `set_config($1,$2,true)` (transaction-local, pool-safe, injection-safe), runs `fn(client)`, and COMMIT/ROLLBACKs. RLS policies in `001_init.sql` read `app.current_tenant`, so isolation is automatic — application code physically cannot leak across tenants.

### 4.6 `domain/collectionCare.ts` — the hero
`evaluateReading(client, tenantId, reading)`: (1) inserts into `cc_reading`; (2) loads the zone's **active** `cc_zone_target`; (3) checks **absolute band** and **rate-of-change** (RH) → severity `watch|breach|critical`; (4) on breach: de-duplicates against any open excursion for that zone+metric, else creates `cc_excursion`, names at-risk objects from `cc_object_link`, raises a `wo_work_order` (`source='excursion'`) with conservation notes, links the WO back to the excursion, and returns alerts for Conservation Officer + FM. **This is the template for every logic-heavy module: a `domain/` function taking `(client, tenantId, …)` and run inside `withTenant`.**

### 4.7 `adapters/` — sensor integration
`SensorAdapter` = `{ vendor, parse(payload) → {externalId, readings[]} }`. `canonicalMetric(label)` maps vendor metric labels → FMIQ codes (`temp|rh|lux|uv|co2|voc|shock`). `conserv.ts` implements one vendor defensively (unknown metrics dropped, not rejected). **Adding a vendor = a new adapter file + one line in `routes/adapters.ts`; the engine is never touched.** This is the "standard connectors, not bespoke" claim, in code.

### 4.8 `routes/` (all registered in `server.ts`)
| File | Endpoints |
|---|---|
| `zones.ts` | `GET /api/v1/zones` — live per-zone status (latest RH/temp, band, RAG) |
| `readings.ts` | `GET /api/v1/zones/:zoneId/readings` — trend series (metric, hours) |
| `ingest.ts` | `POST /api/v1/ingest/readings` — one normalised reading → `evaluateReading` (role-gated) |
| `adapters.ts` | `POST /api/v1/adapters/:vendor/webhook` — vendor payload → adapter → engine |
| `workOrders.ts` | `GET /api/v1/work-orders` · `POST /api/v1/work-orders/ack` |
| `portfolio.ts` | `GET /api/v1/summary` · `/sites` · `/compliance` · `/projects` (dashboard reads) |

### 4.9 `domain/gateEngine.ts` — the readiness/approval gate primitive (002)
`evaluateGates(client, tenantId, ctx)` runs the checks in `GATE_REGISTRY[gateCode]`, writes a per-check `wo_gate_check` snapshot + a `core_audit_log` entry, and returns a mode-aware verdict (`blocked` = HARD + not satisfied). `overrideGate(...)` enforces an allowed role (from `gate_definition.override_roles`, else platform default) + a documented reason, and audits it. Config (mode/on-block/override roles) is **data** in `gate_definition`; checks are **code**. The plug-in point for the SSoW gate (RAMS/permit/competency/parts/pre-task/keys) as those tables land. Mirrors `collectionCare.ts`.

### 4.10 `domain/outbox.ts` + `workers/outboxRelay.ts` — eventing (003)
`emitEvent(client, opts)` writes a CloudEvents 1.0 envelope to `evt_outbox` inside the caller's tenant tx (atomic with the domain write; `ON CONFLICT (idempotency_key) DO NOTHING`). `collectionCare.ts` emits `fmiq.excursion.opened` this way. `relayBatch(client, transport)` (run via `withOutboxWorker`, which sets the worker GUC) claims pending rows `FOR UPDATE SKIP LOCKED`, publishes them, and marks processed or backs off (bounded retries → `failed_at` dead-letter). `startOutboxRelay()` is the poll loop; the API starts it in-process when `OUTBOX_RELAY` is enabled. Production transport = Service Bus; MVP = `LogTransport`.

### 4.11 Web (`packages/web/src`)
`api.ts` — typed `api<T>(path, init)` wrapper; attaches `Authorization: Bearer` via MSAL `acquireTokenSilent` when auth is enabled; exports the response interfaces (`Zone`, `WorkOrder`, `Summary`, `Site`, `Obligation`, `Project`, `ReadingSeries`, `EvalResult`). `authConfig.ts` — `authEnabled` is true only when `VITE_ENTRA_CLIENT_ID` is set; otherwise the SPA runs in dev mode against the API's `DEV_NO_AUTH`. `App.tsx` — currently one ~412-line file with a nav (`command, dashboard, maintenance, compliance, estate, projects, sustain, integrations, reports`); split into `views/` + `components/` once modules grow (see master plan §9).

---

## 5. Data model (`db/migrations/001_init.sql`)

All tenant-scoped tables: `uuid` PK (`gen_random_uuid()`), a `tenant_id` FK to `core_tenant`, **RLS** (`ENABLE` + `FORCE` + a `tenant_isolation` policy on `app.current_tenant`), and a composite index `ix_<t>_tenant (tenant_id, id)`. App role `fmiq_app` is least-privilege (DML only; **`UPDATE/DELETE` revoked on `core_audit_log`** → append-only).

| Prefix | Tables | Notes |
|---|---|---|
| `core_` | `core_tenant`, `core_user`, `core_role`, `core_user_role`, `core_audit_log` | tenancy, identity, RBAC, **append-only audit** |
| `est_` | `est_site → est_building → est_floor → est_space → est_asset` | the estate / Asset Information Model spine |
| `cc_` | `cc_case`, `cc_zone`, `cc_standard`, `cc_zone_target`, `cc_sensor`, `cc_reading`*, `cc_excursion`, `cc_object_link`, `cc_loan` | collection-care (the wedge); `cc_standard` seeded (ASHRAE/BS4971/Bizot/PAS198) |
| `wo_` | `wo_contractor`, `wo_work_order` | maintenance — `wo_work_order` has `source ∈ reactive\|ppm\|excursion\|inspection` |
| `cmp_` | `cmp_obligation` | compliance (RAG only so far) |
| `prj_` | `prj_project` | projects (CWMF stage, budget/spend) |

\* `cc_reading` is a **TimescaleDB hypertable** with an hourly continuous aggregate `cc_reading_hourly`.

| `gate_*`/`wo_gate_check` | `gate_definition`, `wo_gate_check` | gate engine (002) — config-as-data + per-check evaluation snapshots |
| `evt_` | `evt_outbox` | eventing backbone (003) — transactional outbox, CloudEvents 1.0, RLS + worker GUC |

**Migrations applied:** `001_init` → `017_sustainability` (prod `NNN_*.sql` + dev `NNN_*.dev.sql`; the dev DB scripts and the test harness apply all `*.dev.sql` in order). Coverage: platform spine + collection-care (001), gate engine (002), eventing (003), counters (004), calendar+notifications (005), PPM (006), compliance certs (007), SSoW (008), approvals (009), inventory (010), WO close-out (011), eTax (012), ERP (013), **Handover Gate (014)**, **soft services/IPM/waste (015)**, **lifecycle costing (016)**, **sustainability/Bizot/SEAI (017)**. Domain modules in `src/domain/` mirror each (calendar, notifications, ppm, compliance, ssow, approvals, inventory, taxClearance, lifeSafety, cms, handover, softServices, lifecycle, sustainability, preconditioning, dashboards) + `workOrders`. Adapters in `src/adapters/` (conserv, hanwell, tandd, revenue, firePanel, emergencyLighting, axiell, cobie, metEireann, erp/{agresso,sap}).

**Planned tables (not yet built):** `lcc_forecast`/`lcc_scenario` (persisted forecasts), digital-twin/IFC viewer assets (P3).

---

## 6. Conventions (follow exactly)

1. **Tenant data only via `withTenant`.** Never `pool.query()` tenant data directly — without `app.current_tenant` set, RLS returns nothing (or, with a privileged role, would leak). One `withTenant` per request unit of work.
2. **ESM import paths end in `.js`** even when importing a `.ts` file (NodeNext): `import { config } from './config.js'`.
3. **Validate input with zod** at the route boundary; `safeParse` → 400 with `error.flatten()` on failure.
4. **Logic-heavy work lives in `domain/`** as `(client, tenantId, …) → result` functions; thin CRUD stays in the route file. Mirror `collectionCare.ts`.
5. **Role-gate writes** with `requireRole(...)` as a `preHandler`.
6. **Migrations are sequential and immutable** — never edit `001_init.sql`; add `002_*.sql`, `003_*.sql`. Every new tenant table needs `ENABLE`+`FORCE` RLS, a `tenant_isolation` policy, the `tenant_id` index, and a `GRANT` to `fmiq_app` **in the same migration** (reuse the `DO $$ FOREACH` block from `001_init.sql`).
7. **Audit on every state change** — write to `core_audit_log` (entity, entity_id, action, before/after jsonb, user, at). It is append-only by design.
8. **New endpoints** under `/api/v1/*`, registered in `server.ts`, mirrored as a typed interface in `web/src/api.ts`.

---

## 7. Gotchas (FMIQ-specific)

- **`DEV_NO_AUTH` defaults to `true`** (`config.ts`). It injects a dev tenant + `[ConservationOfficer, FacilitiesManager]`. **Must be `false` in any deployed environment** or there is no auth.
- **Two `001` migrations:** `001_init.sql` (real/Azure) and `001_init.dev.sql` (used by `scripts/dev.mjs` with embedded-postgres, where some extensions differ). Keep them in sync when changing schema.
- **`set_config(..., true)` is transaction-scoped** — correct with pooling. Don't set `app.current_tenant` outside a `withTenant` transaction; it won't persist and RLS will return zero rows.
- **Never use a `BYPASSRLS`/superuser role for app queries.** App connects as `fmiq_app`. The DBA role (`fmiq_admin`, in the master plan) is for DDL only, never on the request path.
- **Work-order refs are placeholders** — `collectionCare.ts` mints `WO-<random>`. A real ref scheme is still TBD; don't depend on the format.
- **`packages/api/.data/` is the embedded-PG data dir and is git-ignored** (root + `app/.gitignore`). Never commit it; do not treat anything under it as source.
- **Outbox worker visibility uses a GUC, not a privileged role.** `evt_outbox`'s RLS policy also passes when `app.worker_mode='on'`, set transaction-locally only by `withOutboxWorker` (the relay). Request/app code must never set it. Its policy uses `NULLIF(current_setting('app.current_tenant',true),'')::uuid` because an unset custom GUC on a reused pooled connection reads as `''` (not NULL) and `''::uuid` errors — keep that pattern for any table the worker reads.
- **Excursions de-duplicate per zone+metric while open** — re-breaching an already-open zone reuses the excursion and raises no second WO. Account for this when adding alerting/escalation.
- **Collection-care evaluates RH (and partially temp) only** in this slice; lux/uv/co2 thresholds exist in `cc_zone_target` but aren't yet enforced by the engine.

---

## 8. Add-a-module recipe

1. **Migration** `00N_<module>.sql` — tables with `tenant_id`, RLS enable+force+policy, `tenant_id` index, `GRANT` to `fmiq_app`.
2. **Domain** `domain/<module>.ts` (if logic-heavy) — pure-ish functions `(client, tenantId, …)`.
3. **Routes** `routes/<module>.ts` — `withTenant` + `requireRole` + zod; endpoints under `/api/v1/`.
4. **Register** the route fn in `server.ts`.
5. **Types** — add to `types.ts` (server) and a typed interface in `web/src/api.ts` (client).
6. **Test** — a unit test for the domain logic **and an RLS isolation test** (two tenants; assert tenant B sees zero of tenant A's rows) before it reaches staging.

---

## 9. Commands

```bash
npm run dev          # embedded Postgres + API (:8080) + web (:5173), one process
npm run dev:api      # API only
npm run dev:web      # web only
npm run db:start     # start local Postgres (persistent data dir)
npm run db:setup     # apply migration + seed
npm run db:reset     # drop + re-apply migration + seed cleanly
npm run build        # tsc (api) + vite build (web)
npm run typecheck    # tsc --noEmit across both packages
npm test             # api: vitest run — RLS isolation + unit (needs a Postgres; see below)
npm run test:coverage# api: vitest + v8 coverage (gate engine branch threshold)
```

**Tests need a Postgres.** The vitest `globalSetup` creates a fresh `fmiq_test` DB and applies every `*.dev.sql` migration as `fmiq_app`. Point it at a server with `TEST_PG_ADMIN_URL` (CI uses a Docker `postgres:16` service on `localhost:5432`); locally, run any PG 16 on `127.0.0.1:54329` (trust auth). CI runs the suite in its own job (`.github/workflows/ci.yml`) so RLS tests are never skipped.

---

_When this codebase grows, keep this navigator current — it is the contract every contributor (human or agent) reads first. It can later be promoted to an auto-triggering Skill via Settings → Capabilities (mirroring `goviq-codebase-navigator`)._
