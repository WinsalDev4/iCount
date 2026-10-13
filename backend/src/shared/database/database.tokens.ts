import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

/** Drizzle client shared by every repository (`@Inject(DATABASE)`). */
export const DATABASE = Symbol('DATABASE');
export const PG_POOL = Symbol('PG_POOL');

export type Database = NodePgDatabase;
