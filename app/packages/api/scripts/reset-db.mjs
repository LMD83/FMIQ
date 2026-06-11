// Clean reset: drop + recreate the fmiq database, then migrate + seed.
// Use when you want a fresh DB (the migration is not re-runnable in place).
// Requires the embedded Postgres to be running (npm run db:start, or a prior db:up).
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { basename, dirname, join } from 'node:path';
import pg from 'pg';
import 'dotenv/config';

const here = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PGPORT ?? 5432);
const appDb = 'fmiq';
const appUser = 'fmiq_app';
const adminUrl = `postgresql://postgres:password@localhost:${port}/postgres`;
const appUrl =
  process.env.DATABASE_URL ?? `postgresql://${appUser}:fmiq_app@localhost:${port}/${appDb}`;

async function main() {
  const admin = new pg.Client({ connectionString: adminUrl });
  try {
    await admin.connect();
  } catch {
    console.error('✗ Postgres is not running. Start it first: npm run db:start (or npm run db:up).');
    process.exit(1);
  }
  // Ensure the app role exists (db:up normally creates it).
  const role = await admin.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [appUser]);
  if (role.rowCount === 0) {
    await admin.query(`CREATE ROLE ${appUser} WITH LOGIN PASSWORD 'fmiq_app' CREATEDB`);
  }
  await admin.query(
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
    [appDb],
  );
  await admin.query(`DROP DATABASE IF EXISTS ${appDb}`);
  await admin.query(`CREATE DATABASE ${appDb} OWNER ${appUser}`);
  await admin.end();
  console.log(`→ recreated database ${appDb}`);

  const needsSsl = /neon\.tech|azure|sslmode=require/i.test(appUrl);
  const client = new pg.Client({ connectionString: appUrl, ssl: needsSsl ? { rejectUnauthorized: false } : undefined });
  await client.connect();
  const migDir = join(here, '../db/migrations');
  const migrations = process.env.MIGRATION
    ? [process.env.MIGRATION]
    : readdirSync(migDir).filter((f) => f.endsWith('.dev.sql')).sort();
  const files = [...migrations.map((m) => join(migDir, m)), join(here, '../db/seed.sql')];
  for (const f of files) {
    process.stdout.write(`→ applying ${basename(f)} … `);
    await client.query(readFileSync(f, 'utf8'));
    console.log('ok');
  }
  await client.end();
  console.log('\n✓ Database reset, migrated and seeded. Start the API: npm run dev');
}

main().catch((err) => {
  console.error('\n✗ reset failed:', err?.message ?? String(err));
  process.exit(1);
});
