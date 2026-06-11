// One command to run everything: embedded Postgres (in-process) + API + Web.
// Usage (from project root or app/): npm run dev   — Ctrl+C stops all three.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, '..');                       // app/
const apiRoot = join(appRoot, 'packages', 'api');
const dataDir = join(apiRoot, '.data', 'postgres');     // same dir db:start uses → reuses seeded data
const port = Number(process.env.PGPORT ?? 5432);

const adminUrl = `postgresql://postgres:password@localhost:${port}/postgres`;
const appUrl = `postgresql://fmiq_app:fmiq_app@localhost:${port}/fmiq`;
const migrationsDir = join(apiRoot, 'db', 'migrations');
const seedFile = join(apiRoot, 'db', 'seed.sql');

// Each dev migration + the sentinel table that proves it has been applied.
// Add new migrations here so `npm run dev` brings an existing DB up to date.
const devMigrations = [
  { file: '001_init.dev.sql', sentinel: 'core_tenant', seedAfter: true },
  { file: '002_gate_engine.dev.sql', sentinel: 'gate_definition' },
  { file: '003_eventing.dev.sql', sentinel: 'evt_outbox' },
];

const log = (m) => console.log(`\x1b[36m[dev]\x1b[0m ${m}`);

let postgres = null;
const children = [];
let shuttingDown = false;

async function alreadyRunning() {
  const c = new pg.Client({ connectionString: adminUrl });
  try { await c.connect(); await c.query('SELECT 1'); return true; }
  catch { return false; }
  finally { try { await c.end(); } catch { /* ignore */ } }
}

async function ensureRoleAndDb() {
  const c = new pg.Client({ connectionString: adminUrl });
  await c.connect();
  const role = await c.query('SELECT 1 FROM pg_roles WHERE rolname = $1', ['fmiq_app']);
  if (role.rowCount === 0) {
    await c.query(`CREATE ROLE fmiq_app WITH LOGIN PASSWORD 'fmiq_app' CREATEDB`);
    log('created role fmiq_app');
  }
  const db = await c.query('SELECT 1 FROM pg_database WHERE datname = $1', ['fmiq']);
  if (db.rowCount === 0) {
    await c.query('CREATE DATABASE fmiq OWNER fmiq_app');
    log('created database fmiq');
  }
  await c.end();
}

async function migrateIfNeeded() {
  const c = new pg.Client({ connectionString: appUrl });
  await c.connect();
  try {
    for (const m of devMigrations) {
      const r = await c.query(`SELECT to_regclass($1) AS t`, [`public.${m.sentinel}`]);
      if (r.rows[0].t !== null) {
        log(`${m.file} already applied — skipping`);
        continue;
      }
      const files = [join(migrationsDir, m.file), ...(m.seedAfter ? [seedFile] : [])];
      for (const f of files) {
        process.stdout.write(`\x1b[36m[dev]\x1b[0m applying ${basename(f)} … `);
        await c.query(readFileSync(f, 'utf8'));
        console.log('ok');
      }
    }
  } finally {
    await c.end();
  }
}

function spawnChild(name, args) {
  const child = spawn('npm', args, { cwd: appRoot, stdio: 'inherit', shell: true, env: process.env });
  child.on('exit', (code) => {
    if (!shuttingDown) { log(`${name} exited (code ${code}) — shutting down`); shutdown(); }
  });
  children.push(child);
}

async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  log('stopping…');
  for (const c of children) { try { c.kill(); } catch { /* ignore */ } }
  if (postgres) { try { await postgres.stop(); } catch { /* ignore */ } }
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

async function main() {
  if (await alreadyRunning()) {
    log(`Postgres already listening on :${port} — reusing it`);
  } else {
    mkdirSync(dataDir, { recursive: true });
    postgres = new EmbeddedPostgres({
      databaseDir: dataDir, user: 'postgres', password: 'password', port,
      persistent: true, initdbFlags: ['--encoding=UTF8', '--locale=C'],
      onLog: () => {}, onError: (m) => process.stderr.write(`${String(m)}\n`),
    });
    if (!existsSync(join(dataDir, 'PG_VERSION'))) { log('initialising embedded Postgres…'); await postgres.initialise(); }
    await postgres.start();
    log(`embedded Postgres listening on :${port}`);
  }

  await ensureRoleAndDb();
  await migrateIfNeeded();

  log('starting API (:8080) and Web (:3001)…');
  spawnChild('api', ['run', 'dev:api']);
  spawnChild('web', ['run', 'dev:web']);
  log('all up — open http://localhost:3001   (Ctrl+C to stop everything)');
}

main().catch(async (err) => {
  console.error('\x1b[31m[dev] failed:\x1b[0m', err?.message ?? String(err));
  await shutdown();
});
