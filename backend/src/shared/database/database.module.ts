import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

import { APP_CONFIG, type AppConfig } from '../config/app-config.js';
import { DATABASE, PG_POOL } from './database.tokens.js';

/**
 * Infrastructure: one connection pool per process and a Drizzle client on top.
 * Spring analogy: the DataSource + JdbcTemplate beans.
 */
@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) =>
        new pg.Pool({
          connectionString: config.databaseUrl,
          max: 10,
          connectionTimeoutMillis: 5_000,
        }),
    },
    {
      provide: DATABASE,
      inject: [PG_POOL],
      useFactory: (pool: pg.Pool) => drizzle({ client: pool }),
    },
  ],
  exports: [DATABASE],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: pg.Pool) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
