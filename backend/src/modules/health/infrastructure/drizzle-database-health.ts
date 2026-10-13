import { Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';

import { DATABASE, type Database } from '../../../shared/database/database.tokens.js';
import { DatabaseHealthIndicator } from '../domain/health-report.js';

export class DrizzleDatabaseHealth extends DatabaseHealthIndicator {
  constructor(@Inject(DATABASE) private readonly db: Database) {
    super();
  }

  async ping(): Promise<void> {
    await this.db.execute(sql`select 1`);
  }
}
