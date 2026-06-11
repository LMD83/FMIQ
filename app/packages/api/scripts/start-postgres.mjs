// Starts embedded Postgres for local dev (foreground). No Docker/system install needed.
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, '../.data/postgres');
const port = Number(process.env.PGPORT ?? 5432);

mkdirSync(dataDir, { recursive: true });

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'postgres',
  password: 'password',
  port,
  persistent: true,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  onLog: (msg) => process.stdout.write(`${msg}\n`),
  onError: (msg) => process.stderr.write(`${String(msg)}\n`),
});

if (!existsSync(join(dataDir, 'PG_VERSION'))) {
  await pg.initialise();
}
await pg.start();

console.log(`\n✓ Embedded Postgres listening on localhost:${port}`);
console.log('  Superuser: postgres / password');
console.log('  Press Ctrl+C to stop.\n');

const shutdown = async () => {
  await pg.stop();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Keep process alive while Postgres runs.
await new Promise(() => {});
