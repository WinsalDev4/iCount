import { Global, Module } from '@nestjs/common';

import { Clock } from '../../shared/application/clock.js';
import { IdGenerator } from '../../shared/application/id-generator.js';
import { TransactionRunner } from '../../shared/application/transaction-runner.js';
import { HouseholdAccess } from '../households/application/household-access.js';
import { HouseholdsModule } from '../households/households.module.js';
import { TransactionRepository } from '../transactions/domain/transaction-repository.js';
import { TransactionsModule } from '../transactions/transactions.module.js';
import {
  AddComment,
  DecideOnTransaction,
  ListActivity,
  ListComments,
} from './application/activity.use-cases.js';
import { ActivityFeed, ActivityLog, CommentRepository } from './domain/activity.js';
import {
  DrizzleActivityFeed,
  DrizzleActivityLog,
  DrizzleCommentRepository,
} from './infrastructure/persistence/drizzle-activity.repositories.js';
import { ActivityController } from './interface/http/activity.controller.js';

/**
 * The writing side of the feed. Global so that transactions, households and
 * settlements can record events without importing the activity module (which
 * itself depends on transactions): no import cycle.
 */
@Global()
@Module({
  providers: [{ provide: ActivityLog, useClass: DrizzleActivityLog }],
  exports: [ActivityLog],
})
export class ActivityLogModule {}

/** Household feed, approval of shared movements and comments (ADR-0016). */
@Module({
  imports: [HouseholdsModule, TransactionsModule],
  controllers: [ActivityController],
  providers: [
    { provide: ActivityFeed, useClass: DrizzleActivityFeed },
    { provide: CommentRepository, useClass: DrizzleCommentRepository },
    {
      provide: ListActivity,
      inject: [HouseholdAccess, ActivityFeed],
      useFactory: (...deps: ConstructorParameters<typeof ListActivity>) =>
        new ListActivity(...deps),
    },
    {
      provide: DecideOnTransaction,
      inject: [
        HouseholdAccess,
        TransactionRepository,
        ActivityLog,
        ActivityFeed,
        TransactionRunner,
        Clock,
      ],
      useFactory: (...deps: ConstructorParameters<typeof DecideOnTransaction>) =>
        new DecideOnTransaction(...deps),
    },
    {
      provide: ListComments,
      inject: [HouseholdAccess, TransactionRepository, CommentRepository],
      useFactory: (...deps: ConstructorParameters<typeof ListComments>) =>
        new ListComments(...deps),
    },
    {
      provide: AddComment,
      inject: [
        HouseholdAccess,
        TransactionRepository,
        CommentRepository,
        ActivityLog,
        TransactionRunner,
        Clock,
        IdGenerator,
      ],
      useFactory: (...deps: ConstructorParameters<typeof AddComment>) => new AddComment(...deps),
    },
  ],
})
export class ActivityModule {}
