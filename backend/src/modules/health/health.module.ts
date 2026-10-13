import { Module } from '@nestjs/common';

import { CheckHealth } from './application/check-health.use-case.js';
import { DatabaseHealthIndicator } from './domain/health-report.js';
import { DrizzleDatabaseHealth } from './infrastructure/drizzle-database-health.js';
import { HealthController } from './interface/http/health.controller.js';

@Module({
  controllers: [HealthController],
  providers: [
    { provide: DatabaseHealthIndicator, useClass: DrizzleDatabaseHealth },
    {
      provide: CheckHealth,
      inject: [DatabaseHealthIndicator],
      useFactory: (database: DatabaseHealthIndicator) => new CheckHealth(database),
    },
  ],
})
export class HealthModule {}
