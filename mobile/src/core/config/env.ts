import { z } from 'zod';

/**
 * Where feature modules read their data from:
 * - `memory`: in-memory repositories with seed data (default; no backend needed).
 * - `api`: REST repositories against the NestJS backend.
 */
export const dataSourceSchema = z.enum(['memory', 'api']);
export type DataSource = z.infer<typeof dataSourceSchema>;

const envSchema = z.object({
  dataSource: dataSourceSchema.default('memory'),
});

export type Env = z.infer<typeof envSchema>;

/** Raw values as they come from `process.env` (empty strings count as "not set"). */
export interface RawEnv {
  readonly EXPO_PUBLIC_DATA_SOURCE?: string;
}

/** Validates configuration once at startup; a typo fails fast instead of misbehaving later. */
export function parseEnv(raw: RawEnv): Env {
  return envSchema.parse({ dataSource: raw.EXPO_PUBLIC_DATA_SOURCE || undefined });
}

// Expo only inlines `EXPO_PUBLIC_*` variables referenced with dot notation on `process.env`.
export const env = parseEnv({
  EXPO_PUBLIC_DATA_SOURCE: process.env.EXPO_PUBLIC_DATA_SOURCE,
});
