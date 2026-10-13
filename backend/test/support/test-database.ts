import { existsSync } from 'node:fs';

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

// Same local backend/.env as the API; variables already set (e.g. in CI) win.
if (existsSync('.env')) process.loadEnvFile('.env');

/**
 * e2e tests use their own database (never the development one) because they
 * truncate tables. Same server as docker-compose.yml; CI sets TEST_DATABASE_URL.
 */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://icount:icount@localhost:5432/icount_test';

/** Creates the test database if needed and applies every migration in backend/drizzle. */
export async function prepareTestDatabase(): Promise<void> {
  const url = new URL(TEST_DATABASE_URL);
  const databaseName = decodeURIComponent(url.pathname.slice(1));

  const adminUrl = new URL(url);
  adminUrl.pathname = '/postgres';
  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    const { rowCount } = await admin.query('select 1 from pg_database where datname = $1', [
      databaseName,
    ]);
    if (!rowCount) await admin.query(`create database ${pg.escapeIdentifier(databaseName)}`);
  } finally {
    await admin.end();
  }

  const pool = new pg.Pool({ connectionString: TEST_DATABASE_URL });
  try {
    await migrate(drizzle({ client: pool }), { migrationsFolder: 'drizzle' });
  } finally {
    await pool.end();
  }
}
