// One-shot local DB bootstrap: start Postgres → create role/db → migrate + seed → keep running.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import 'dotenv/config';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, '../.data/postgres');
const port = Number(process.env.PGPORT ?? 5432);
const adminUrl = `postgresql://postgres:password@localhost:${port}/postgres`;
const appUrl =
  process.env.DATABASE_URL ??
  `postgresql://fmiq_app:fmiq_app@localhost:${port}/fmiq`;
const appUser = 'fmiq_app';
const appPassword = 'fmiq_app';
const appDb = 'fmiq';

async function canConnect(url) {
  const client = new pg.Client({ connectionString: url });
  try {
    await client.connect();
    await client.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    try {
      await client.end();
    } catch {
      /* ignore */
    }
  }
}

async function bootstrap() {
  const client = new pg.Client({ connectionString: adminUrl });
  await client.connect();

  const role = await client.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [appUser]);
  if (role.rowCount === 0) {
    await client.query(`CREATE ROLE ${appUser} WITH LOGIN PASSWORD '${appPassword}' CREATEDB`);
    console.log(`→ created role ${appUser}`);
  }

  const db = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [appDb]);
  if (db.rowCount === 0) {
    await client.query(`CREATE DATABASE ${appDb} OWNER ${appUser}`);
    console.log(`→ created database ${appDb}`);
  }

  await client.end();
}

async function migrateAndSeed() {
  const needsSsl = /neon\.tech|azure|sslmode=require/i.test(appUrl);
  const client = new pg.Client({
    connectionString: appUrl,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  });
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
}

function startDetached() {
  const child = spawn(process.execPath, [join(here, 'start-postgres.mjs')], {
    cwd: join(here, '..'),
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, PGPORT: String(port) },
  });
  child.unref();
  return child.pid;
}

// Already running — just bootstrap + migrate.
if (await canConnect(adminUrl)) {
  console.log(`→ Postgres already running on localhost:${port}`);
  await bootstrap();
  await migrateAndSeed();
  console.log('\n✓ Database is up. API: npm run dev:api  |  Web: npm run dev:web');
  process.exit(0);
}

mkdirSync(dataDir, { recursive: true });

const embedded = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'postgres',
  password: 'password',
  port,
  persistent: true,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  onLog: () => {},
  onError: (msg) => process.stderr.write(`${String(msg)}\n`),
});

console.log(`→ Initialising embedded Postgres on localhost:${port} …`);
if (!existsSync(join(dataDir, 'PG_VERSION'))) {
  await embedded.initialise();
}
await embedded.start();

try {
  await bootstrap();
  await migrateAndSeed();
} finally {
  await embedded.stop();
}

const pid = startDetached();
console.log(`→ Restarted embedded Postgres in background (pid ${pid})`);
console.log('\n✓ Database is up. API: npm run dev:api  |  Web: npm run dev:web');
