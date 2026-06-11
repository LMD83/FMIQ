// E2E API bootstrap: build a fresh, seeded `fmiq_e2e` database, then run the API against
// it (DEV_NO_AUTH so Playwright drives the UI without a live Entra tenant). Playwright's
// webServer starts this and waits for /health.
import { spawn } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, '..');
const apiRoot = join(appRoot, 'packages', 'api');
const migDir = join(apiRoot, 'db', 'migrations');

const host = process.env.PGHOST ?? '127.0.0.1';
const port = Number(process.env.PGPORT ?? 5432);
const db = process.env.E2E_DB ?? 'fmiq_e2e';
const adminUrl = process.env.E2E_ADMIN_URL ?? `postgresql://postgres@${host}:${port}/postgres`;
const appUrl = `postgresql://fmiq_app:fmiq_app@${host}:${port}/${db}`;

async function setup() {
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  if ((await admin.query(`SELECT 1 FROM pg_roles WHERE rolname='fmiq_app'`)).rowCount === 0) {
    await admin.query(`CREATE ROLE fmiq_app LOGIN PASSWORD 'fmiq_app'`);
  }
  await admin.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()`, [db]);
  await admin.query(`DROP DATABASE IF EXISTS ${db}`);
  await admin.query(`CREATE DATABASE ${db} OWNER fmiq_app`);
  await admin.end();

  const client = new pg.Client({ connectionString: appUrl });
  await client.connect();
  for (const f of readdirSync(migDir).filter((x) => x.endsWith('.dev.sql')).sort()) {
    await client.query(readFileSync(join(migDir, f), 'utf8'));
  }
  await client.query(readFileSync(join(apiRoot, 'db', 'seed.sql'), 'utf8'));
  await client.end();
  console.log(`[e2e] seeded ${db} on :${port}`);
}

await setup();

const child = spawn('npm', ['--workspace', 'packages/api', 'run', 'dev'], {
  cwd: appRoot,
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, DATABASE_URL: appUrl, DEV_NO_AUTH: 'true', OUTBOX_RELAY: 'false', PORT: '8080' },
});
const stop = () => child.kill();
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
child.on('exit', (code) => process.exit(code ?? 0));
