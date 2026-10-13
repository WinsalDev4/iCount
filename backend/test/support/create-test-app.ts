import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { sql } from 'drizzle-orm';
import type { App } from 'supertest/types.js';

import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/bootstrap.js';
import { type AppConfig, loadConfig } from '../../src/shared/config/app-config.js';
import { DATABASE, type Database } from '../../src/shared/database/database.tokens.js';
import { TEST_DATABASE_URL } from './test-database.js';

export interface TestApp {
  readonly app: INestApplication<App>;
  readonly db: Database;
  /** Empties the given tables between tests. */
  truncate(...tables: string[]): Promise<void>;
}

/** Boots the real AppModule (real Postgres, real filters and pipes) with test config. */
export async function createTestApp(overrides: Partial<AppConfig> = {}): Promise<TestApp> {
  const config: AppConfig = {
    ...loadConfig({ NODE_ENV: 'test', DATABASE_URL: TEST_DATABASE_URL, LOG_LEVEL: 'silent' }),
    ...overrides,
  };

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.forRoot(config)],
  }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>({ bufferLogs: true });
  configureApp(app);
  await app.init();

  const db = app.get<Database>(DATABASE);
  return {
    app,
    db,
    truncate: async (...tables) => {
      await db.execute(sql.raw(`truncate table ${tables.map((t) => `"${t}"`).join(', ')}`));
    },
  };
}
