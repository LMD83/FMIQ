// Creates the fmiq_app role + fmiq database (idempotent).
import pg from 'pg';

const adminUrl =
  process.env.ADMIN_DATABASE_URL ?? 'postgresql://postgres:password@localhost:5432/postgres';
const appUser = process.env.FMIQ_DB_USER ?? 'fmiq_app';
const appPassword = process.env.FMIQ_DB_PASSWORD ?? 'fmiq_app';
const appDb = process.env.FMIQ_DB_NAME ?? 'fmiq';

const client = new pg.Client({ connectionString: adminUrl });

try {
  await client.connect();

  const role = await client.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [appUser]);
  if (role.rowCount === 0) {
    await client.query(
      `CREATE ROLE ${appUser} WITH LOGIN PASSWORD '${appPassword}' CREATEDB`,
    );
    console.log(`→ created role ${appUser}`);
  }

  const db = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [appDb]);
  if (db.rowCount === 0) {
    await client.query(`CREATE DATABASE ${appDb} OWNER ${appUser}`);
    console.log(`→ created database ${appDb}`);
  } else {
    console.log(`→ database ${appDb} already exists`);
  }
} catch (err) {
  console.error('✗ bootstrap failed:', err.message ?? err);
  process.exitCode = 1;
} finally {
  try {
    await client.end();
  } catch {
    // already closed after CREATE DATABASE branch
  }
}
