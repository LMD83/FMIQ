import type { PoolClient } from 'pg';
import { pool } from './pool.js';

/**
 * Runs `fn` inside a transaction with the Postgres session variable
 * `app.current_tenant` set to the caller's tenant. Row-Level Security policies
 * (see 001_init.sql) read that variable, so every query is automatically
 * isolated to the tenant — there is no way for application code to "forget"
 * a WHERE tenant_id clause and leak across tenants.
 *
 * SET LOCAL is transaction-scoped, so the binding is released on COMMIT/ROLLBACK
 * and is safe with connection pooling.
 */
export async function withTenant<T>(
  tenantId: string,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // set_config(name, value, is_local=true) — parameterised, avoids SQL injection
    await client.query('SELECT set_config($1, $2, true)', ['app.current_tenant', tenantId]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
