# FMIQ — Local end-to-end runbook

Goal: Postgres (with TimescaleDB) → API → Web, then watch the closed loop fire live.
Prereqs: **Node 20+** and **Docker Desktop** (easiest Postgres path). On Windows, run these in **PowerShell** from the `app/` folder.

> Sanity check already done: the collection-care engine executes correctly (critical rate-of-change excursion → 3 named objects → work order → alerts). These steps stand the rest of the stack up around it.

---

## Step 1 — Start Postgres + TimescaleDB (Docker)

```bash
docker run -d --name fmiq-pg -p 5432:5432 \
  -e POSTGRES_PASSWORD=fmiq -e POSTGRES_DB=fmiq \
  timescale/timescaledb-ha:pg16
```

Wait ~15s for it to boot. Check: `docker logs fmiq-pg | tail -5` (look for "database system is ready").

_No Docker? Install Postgres 16 locally + the TimescaleDB and PostGIS extensions, create a `fmiq` database, and use your own connection string in Step 3._

## Step 2 — Apply schema + seed

```bash
# from app/
docker cp packages/api/db/migrations/001_init.sql fmiq-pg:/init.sql
docker cp packages/api/db/seed.sql fmiq-pg:/seed.sql
docker exec -u postgres fmiq-pg psql -d fmiq -f /init.sql
docker exec -u postgres fmiq-pg psql -d fmiq -f /seed.sql
```

Expect a stream of `CREATE TABLE` / `INSERT`. If `CREATE EXTENSION postgis` errors on a non-HA image, that one line is optional (only `est_site.geo` uses it) — comment it out and re-run.

## Step 3 — Run the API

```bash
cd packages/api
cp .env.example .env          # DEV_NO_AUTH=true, DATABASE_URL points at localhost:5432
npm install
npm run dev                   # → http://localhost:8080
```

Verify: open `http://localhost:8080/health` → `{"status":"ok",...}`.
Quick engine test from the terminal (PowerShell):
```bash
curl -X POST http://localhost:8080/api/v1/ingest/readings -H "Content-Type: application/json" ^
  -d "{\"sensorId\":\"00000000-0000-0000-0000-000000000121\",\"zoneId\":\"00000000-0000-0000-0000-000000000101\",\"metric\":\"rh\",\"value\":63.2}"
```
→ returns the excursion + named objects + work order ref.

## Step 4 — Run the Web app

```bash
# new terminal, from app/
cd packages/web
cp .env.example .env          # client id blank = dev mode, no login
npm install
npm run dev                   # → http://localhost:5173
```

Open **http://localhost:5173** → you'll see the live zones from the API. Click **"Simulate RH excursion (63.2%)"** and watch the loop close: the result panel names the three at-risk objects, shows the auto-raised work order, and the zone flips to *Excursion*. Hit **Refresh** to see the new work order in the table.

## Switching on real Entra SSO (later)
Set `DEV_NO_AUTH=false` + Entra vars in `packages/api/.env`, and `VITE_ENTRA_CLIENT_ID` in `packages/web/.env`. See `../docs/architecture-adr.md`.

## Teardown
```bash
docker rm -f fmiq-pg
```

## Common snags
- **Port 5432 in use:** another Postgres is running — stop it or map `-p 5433:5432` and update `DATABASE_URL`.
- **API can't connect:** confirm `docker ps` shows fmiq-pg healthy; check `DATABASE_URL` host/port.
- **`fmiq_app` auth:** the migration creates that role (password `fmiq_app`). The API connects as it (non-superuser) so RLS is actually enforced.
- **Web shows "API unavailable":** start the API first (Step 3) — the web proxies `/api` to `:8080`.
