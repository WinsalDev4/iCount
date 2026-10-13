import { z } from 'zod';

/**
 * Environment variables the API needs. Validated once at startup: a missing or
 * malformed value stops the process with a readable message (fail fast),
 * like Spring Boot refusing to start on an invalid @ConfigurationProperties.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(0).max(65_535).default(3000),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export type NodeEnv = z.infer<typeof envSchema>['NODE_ENV'];
export type LogLevel = z.infer<typeof envSchema>['LOG_LEVEL'];

export interface AppConfig {
  readonly nodeEnv: NodeEnv;
  readonly port: number;
  readonly databaseUrl: string;
  readonly logLevel: LogLevel;
}

/** Injection token for the validated configuration. */
export const APP_CONFIG = Symbol('APP_CONFIG');

export class InvalidConfigError extends Error {
  constructor(details: string) {
    super(`Invalid environment configuration:\n${details}`);
    this.name = 'InvalidConfigError';
  }
}

export function loadConfig(env: Record<string, string | undefined>): AppConfig {
  // Empty strings (e.g. `PORT=` in a .env file) count as "not set".
  const cleaned = Object.fromEntries(Object.entries(env).filter(([, value]) => value !== ''));
  const result = envSchema.safeParse(cleaned);
  if (!result.success) throw new InvalidConfigError(z.prettifyError(result.error));

  const { NODE_ENV, PORT, DATABASE_URL, LOG_LEVEL } = result.data;
  return { nodeEnv: NODE_ENV, port: PORT, databaseUrl: DATABASE_URL, logLevel: LOG_LEVEL };
}
