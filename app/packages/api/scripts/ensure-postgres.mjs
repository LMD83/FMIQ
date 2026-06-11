// Ensures Postgres is reachable on localhost:5432; starts embedded instance if needed.
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PGPORT ?? 5432);
const adminUrl =
  process.env.ADMIN_DATABASE_URL ?? `postgresql://postgres:password@localhost:${port}/postgres`;
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

async function waitForPostgres(maxMs = 60_000) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    if (await canConnect(adminUrl)) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function startDetached() {
  const script = join(here, 'start-postgres.mjs');
  const child = spawn(process.execPath, [script], {
    cwd: join(here, '..'),
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, PGPORT: String(port) },
  });
  child.unref();
  return child.pid;
}

if (await canConnect(adminUrl)) {
  console.log(`→ Postgres already running on localhost:${port}`);
  process.exit(0);
}

console.log(`→ Starting embedded Postgres on localhost:${port} …`);
const pid = startDetached();
console.log(`→ Embedded Postgres process started (pid ${pid})`);

if (!(await waitForPostgres())) {
  console.error('✗ Timed out waiting for Postgres to accept connections.');
  process.exit(1);
}

console.log('✓ Postgres is ready');
