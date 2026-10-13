import { z } from 'zod';

/**
 * Where feature modules read their data from:
 * - `memory`: in-memory repositories with seed data (default; no backend needed).
 * - `api`: REST repositories against the NestJS backend.
 */
export const dataSourceSchema = z.enum(['memory', 'api']);
export type DataSource = z.infer<typeof dataSourceSchema>;

/**
 * Local API from a device: the iOS simulator reaches the PC as `localhost`;
 * the Android emulator needs `http://10.0.2.2:3000` and a physical phone the PC's LAN IP.
 */
export const DEFAULT_API_URL = 'http://localhost:3000';

const envSchema = z.object({
  dataSource: dataSourceSchema.default('memory'),
  apiUrl: z.url({ protocol: /^https?$/ }).default(DEFAULT_API_URL),
});

export type Env = z.infer<typeof envSchema>;

/** Raw values as they come from `process.env` (empty strings count as "not set"). */
export interface RawEnv {
  readonly EXPO_PUBLIC_DATA_SOURCE?: string;
  readonly EXPO_PUBLIC_API_URL?: string;
}

/** Validates configuration once at startup; a typo fails fast instead of misbehaving later. */
export function parseEnv(raw: RawEnv): Env {
  return envSchema.parse({
    dataSource: raw.EXPO_PUBLIC_DATA_SOURCE || undefined,
    apiUrl: raw.EXPO_PUBLIC_API_URL || undefined,
  });
}

// Expo only inlines `EXPO_PUBLIC_*` variables referenced with dot notation on `process.env`.
export const env = parseEnv({
  EXPO_PUBLIC_DATA_SOURCE: process.env.EXPO_PUBLIC_DATA_SOURCE,
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
});
