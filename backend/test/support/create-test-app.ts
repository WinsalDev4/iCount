import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { sql } from 'drizzle-orm';
import type { App } from 'supertest/types.js';

import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/bootstrap.js';
import { usersTable } from '../../src/modules/auth/infrastructure/persistence/auth.schema.js';
import { AccessTokenService } from '../../src/shared/auth/access-token.service.js';
import { type AppConfig, loadConfig } from '../../src/shared/config/app-config.js';
import { DATABASE, type Database } from '../../src/shared/database/database.tokens.js';
import { EmailSender } from '../../src/shared/email/email-sender.js';
import { InMemoryEmailSender } from './in-memory-email-sender.js';
import { TEST_DATABASE_URL } from './test-database.js';

/** Built-in categories; TRUNCATE … CASCADE on households also empties `categories`. */
const CATEGORY_SEED = readFileSync('drizzle/0004_seed_categories.sql', 'utf8');

export const TEST_JWT_SECRET = 'e2e-secret-that-is-long-enough-for-hs256!!';

export interface SignedInUser {
  readonly userId: string;
  readonly email: string;
  /** `{ Authorization: 'Bearer …' }` for supertest's `.set()`. */
  readonly headers: Record<string, string>;
}

export interface TestApp {
  readonly app: INestApplication<App>;
  readonly db: Database;
  /** Every email the app sent (no SMTP in tests). */
  readonly emails: InMemoryEmailSender;
  /** Empties the given tables between tests (and restores the built-in categories). */
  truncate(...tables: string[]): Promise<void>;
  /** Creates a user straight in the database and returns a valid access token for it. */
  signIn(email?: string): Promise<SignedInUser>;
}

type ConfigOverrides = Partial<Omit<AppConfig, 'auth' | 'mail'>>;

/** Boots the real AppModule (real Postgres, real filters, pipes and guards) with test config. */
export async function createTestApp(overrides: ConfigOverrides = {}): Promise<TestApp> {
  const config: AppConfig = {
    ...loadConfig({
      NODE_ENV: 'test',
      DATABASE_URL: TEST_DATABASE_URL,
      LOG_LEVEL: 'silent',
      JWT_SECRET: TEST_JWT_SECRET,
    }),
    ...overrides,
  };

  const emails = new InMemoryEmailSender();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(config)] })
    .overrideProvider(EmailSender)
    .useValue(emails)
    .compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>({ bufferLogs: true });
  configureApp(app);
  await app.init();

  const db = app.get<Database>(DATABASE);
  const accessTokens = app.get(AccessTokenService);
  return {
    app,
    db,
    emails,
    truncate: async (...tables) => {
      const list = tables.map((t) => `"${t}"`).join(', ');
      await db.execute(sql.raw(`truncate table ${list} cascade`));
      await db.execute(sql.raw(CATEGORY_SEED));
    },
    signIn: async (email = `user-${randomUUID()}@icount.test`) => {
      const userId = randomUUID();
      await db.insert(usersTable).values({ id: userId, email, createdAt: new Date() });
      const { token } = await accessTokens.issue(userId);
      return { userId, email, headers: { Authorization: `Bearer ${token}` } };
    },
  };
}
