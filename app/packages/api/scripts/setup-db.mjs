// Applies the dev schema + seed via the pg driver — no psql client needed.
// Usage: npm run db:setup   (reads DATABASE_URL from .env)
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { basename, dirname, join } from 'node:path';
import pg from 'pg';
import 'dotenv/config';

const here = dirname(fileURLToPath(import.meta.url));
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('✗ DATABASE_URL is not set. Add it to packages/api/.env (e.g. your Neon or Azure Postgres connection string).');
  process.exit(1);
}

const needsSsl = /neon\.tech|azure|sslmode=require/i.test(url);
const client = new pg.Client({
  connectionString: url,
  ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
});

// Apply all dev migrations in order (or a single MIGRATION override), then seed.
const migDir = join(here, '../db/migrations');
const migrations = process.env.MIGRATION
  ? [process.env.MIGRATION]
  : readdirSync(migDir).filter((f) => f.endsWith('.dev.sql')).sort();
const files = [...migrations.map((m) => join(migDir, m)), join(here, '../db/seed.sql')];

try {
  await client.connect();
  for (const f of files) {
    process.stdout.write(`→ applying ${basename(f)} … `);
    await client.query(readFileSync(f, 'utf8'));
    console.log('ok');
  }
  console.log('\n✓ FMIQ database ready. Start the API: npm run dev');
} catch (err) {
  const msg =
    err?.message ||
    (Array.isArray(err?.errors) ? err.errors.map((e) => e.message).join('; ') : String(err));
  console.error('\n✗ setup failed:', msg);
  process.exitCode = 1;
} finally {
  await client.end();
}
