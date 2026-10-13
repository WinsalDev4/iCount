import { existsSync } from 'node:fs';

import { defineConfig } from 'drizzle-kit';

if (existsSync('.env')) process.loadEnvFile('.env');

/**
 * drizzle-kit: generates SQL migrations from the TypeScript schema (ADR-0012).
 * Each module keeps its tables in `infrastructure/persistence/*.schema.ts`.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/modules/*/infrastructure/persistence/*.schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://icount:icount@localhost:5432/icount',
  },
  strict: true,
  verbose: true,
});
