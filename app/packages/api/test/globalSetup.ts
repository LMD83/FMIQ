// Vitest global setup for the RLS isolation suite (and all DB-backed tests).
//
// Stands up a clean, real Postgres database and applies every *.dev.sql migration
// in order — AS the least-privilege `fmiq_app` role — so RLS (FORCE ROW LEVEL
// SECURITY) is genuinely exercised, exactly as in production. It is CI-friendly:
//   • CI / Docker: point it at a `postgres` service via TEST_PG_ADMIN_URL
//       (e.g. docker run -e POSTGRES_HOST_AUTH_METHOD=trust -p 54329:5432 postgres:16)
//   • Local: run any Postgres 16 on 127.0.0.1:54329 (trust auth) before `npm test`.
//
// The app DB (`fmiq_test`) is dropped and recreated every run for a deterministic
// starting point. The connection string the pool uses is set in vitest.config.ts.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, '..', 'db', 'migrations');

const host = process.env.TEST_PGHOST ?? '127.0.0.1';
const port = Number(process.env.TEST_PGPORT ?? 54329);
const appDb = process.env.TEST_PGDATABASE ?? 'fmiq_test';
const adminUrl = process.env.TEST_PG_ADMIN_URL ?? `postgresql://postgres@${host}:${port}/postgres`;
const appUrl = process.env.TEST_DATABASE_URL ?? `postgresql://fmiq_app:fmiq_app@${host}:${port}/${appDb}`;

export default async function setup(): Promise<void> {
  const admin = new pg.Client({ connectionString: adminUrl });
  try {
    await admin.connect();
  } catch (e) {
    throw new Error(
      `RLS test harness: cannot reach an admin Postgres at ${adminUrl}. ` +
        `Start one (Docker: docker run -e POSTGRES_HOST_AUTH_METHOD=trust -p 54329:5432 postgres:16) ` +
        `or set TEST_PG_ADMIN_URL. Original error: ${(e as Error).message}`,
    );
  }

  // Least-privilege app role + a fresh database owned by it.
  const role = await admin.query('SELECT 1 FROM pg_roles WHERE rolname = $1', ['fmiq_app']);
  if (role.rowCount === 0) {
    await admin.query(`CREATE ROLE fmiq_app LOGIN PASSWORD 'fmiq_app'`);
  }
  await admin.query(
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
    [appDb],
  );
  await admin.query(`DROP DATABASE IF EXISTS ${appDb}`);
  await admin.query(`CREATE DATABASE ${appDb} OWNER fmiq_app`);
  await admin.end();

  // Apply all dev migrations in order, connected AS fmiq_app (mirrors `npm run dev`).
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.dev.sql'))
    .sort();
  const client = new pg.Client({ connectionString: appUrl });
  await client.connect();
  for (const f of files) {
    await client.query(readFileSync(join(migrationsDir, f), 'utf8'));
  }
  await client.end();
}
