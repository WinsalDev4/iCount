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
  /** HS256 secret for access tokens (ADR-0013). At least 32 characters of randomness. */
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  /** SMTP server for transactional email; Mailpit in development (docker compose). */
  SMTP_URL: z.url({ protocol: /^smtps?$/ }).default('smtp://localhost:1025'),
  MAIL_FROM: z.string().min(3).default('iCount <no-reply@icount.local>'),
  /** Where magic links point; the token is appended as `?token=…`. */
  MAGIC_LINK_URL: z.url().default('icount://auth/verify'),
});

export type NodeEnv = z.infer<typeof envSchema>['NODE_ENV'];
export type LogLevel = z.infer<typeof envSchema>['LOG_LEVEL'];

export interface AuthConfig {
  readonly jwtSecret: string;
  readonly accessTokenTtlSeconds: number;
  readonly refreshTokenTtlDays: number;
  readonly magicLinkTtlMinutes: number;
  readonly magicLinkUrl: string;
}

export interface MailConfig {
  readonly smtpUrl: string;
  readonly from: string;
}

export interface AppConfig {
  readonly nodeEnv: NodeEnv;
  readonly port: number;
  readonly databaseUrl: string;
  readonly logLevel: LogLevel;
  readonly auth: AuthConfig;
  readonly mail: MailConfig;
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

  const env_ = result.data;
  return {
    nodeEnv: env_.NODE_ENV,
    port: env_.PORT,
    databaseUrl: env_.DATABASE_URL,
    logLevel: env_.LOG_LEVEL,
    auth: {
      jwtSecret: env_.JWT_SECRET,
      // Fixed by ADR-0013; constants rather than env so they cannot be misconfigured.
      accessTokenTtlSeconds: 15 * 60,
      refreshTokenTtlDays: 30,
      magicLinkTtlMinutes: 15,
      magicLinkUrl: env_.MAGIC_LINK_URL,
    },
    mail: { smtpUrl: env_.SMTP_URL, from: env_.MAIL_FROM },
  };
}
