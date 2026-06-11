# FMIQ — Integrated Workplace Management System

> An IWMS that protects the building, the environment, **and the object** — in one platform.
> Greenfield product by **GovIQ**. Lighthouse: National Museum of Ireland.

The wedge: no incumbent IWMS has collection-care environmental management, and no collection-care tool is an IWMS. FMIQ unifies CAFM + collection-care + BMS + collections management and closes the loop **excursion → at-risk objects → work order → response → loan-ready evidence**.

## Monorepo layout

```
app/
├── packages/
│   ├── api/        Node.js + Fastify + TypeScript API
│   │   ├── db/migrations/001_init.sql   Postgres schema (RLS + TimescaleDB)
│   │   └── src/
│   │       ├── auth/        Entra ID JWT validation + RBAC
│   │       ├── db/          RLS-aware connection pool (per-request tenant context)
│   │       ├── domain/      collectionCare.ts — the excursion engine (hero logic)
│   │       └── routes/      zones, work orders, sensor ingest
│   └── web/        React + Vite + TypeScript SPA (MSAL auth)
└── infra/          Azure Bicep (Postgres Flexible Server, Container Apps, Entra)
```

## Architecture (see ../docs/architecture-adr.md)

- **Auth:** Azure Entra ID, multi-tenant, B2B cross-tenant SSO. `@azure/msal-react` (SPA) + JWT bearer validation (API). App-role RBAC.
- **Data:** Azure Database for PostgreSQL Flexible Server, North Europe (Ireland). Multi-tenant via **Row-Level Security** (`tenant_id` + `FORCE ROW LEVEL SECURITY`). **TimescaleDB** hypertables for sensor telemetry.
- **Residency:** EU Data Boundary; data physically in Ireland.
- **Accessibility:** WCAG 2.2 AA throughout.

## Quickstart (local dev)

```bash
# 1. Postgres with TimescaleDB (Docker)
docker run -d --name fmiq-pg -p 5432:5432 \
  -e POSTGRES_PASSWORD=fmiq -e POSTGRES_DB=fmiq timescale/timescaledb-ha:pg16

# 2. Apply schema + seed
psql postgresql://postgres:fmiq@localhost:5432/fmiq -f packages/api/db/migrations/001_init.sql
psql postgresql://postgres:fmiq@localhost:5432/fmiq -f packages/api/db/seed.sql

# 3. API
cd packages/api && cp .env.example .env && npm install && npm run dev   # :8080

# 4. Web
cd packages/web && cp .env.example .env && npm install && npm run dev   # :5173
```

In `DEV_NO_AUTH=true` the API injects a dev tenant + ConservationOfficer role so you can exercise the collection-care engine without a live Entra tenant. Set to `false` and configure the Entra vars for real SSO.

## The hero, as code

`POST /api/v1/ingest/readings` simulates a sensor reading. When a reading breaches a zone's active standard (absolute or rate-of-change), `domain/collectionCare.ts`:
1. opens a `cc_excursion`,
2. queries `cc_object_link` to **name the at-risk objects**,
3. raises a `wo_work_order` (source `excursion`) with conservation notes,
4. emits alerts (Conservation Officer + FM).

`GET /api/v1/zones` and `GET /api/v1/work-orders` return live state — all tenant-isolated by RLS.

## Status
v0.1 scaffold — architecture spine is real and typechecks; Azure wiring and sensor adapters are stubbed for local dev. See ../docs/roadmap.md.
