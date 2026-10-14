import { Module } from '@nestjs/common';

import { Clock } from '../../shared/application/clock.js';
import { IdGenerator } from '../../shared/application/id-generator.js';
import { TransactionRunner } from '../../shared/application/transaction-runner.js';
import { ActivityLog } from '../activity/domain/activity.js';
import { HouseholdAccess } from '../households/application/household-access.js';
import { HouseholdsModule } from '../households/households.module.js';
import {
  CreateSettlement,
  GetBalance,
  ListSettlements,
} from './application/settlements.use-cases.js';
import { SettlementRepository } from './domain/settlement.js';
import { DrizzleSettlementRepository } from './infrastructure/persistence/drizzle-settlement.repository.js';
import { SettlementsController } from './interface/http/settlements.controller.js';

/** Net balance per member, suggested transfers and recorded settlements (ADR-0016). */
@Module({
  imports: [HouseholdsModule],
  controllers: [SettlementsController],
  providers: [
    { provide: SettlementRepository, useClass: DrizzleSettlementRepository },
    ...[GetBalance, ListSettlements].map((UseCase) => ({
      provide: UseCase,
      inject: [HouseholdAccess, SettlementRepository],
      useFactory: (access: HouseholdAccess, settlements: SettlementRepository) =>
        new UseCase(access, settlements),
    })),
    {
      provide: CreateSettlement,
      inject: [
        HouseholdAccess,
        SettlementRepository,
        ActivityLog,
        TransactionRunner,
        Clock,
        IdGenerator,
      ],
      useFactory: (...deps: ConstructorParameters<typeof CreateSettlement>) =>
        new CreateSettlement(...deps),
    },
  ],
})
export class SettlementsModule {}
