import { Module } from '@nestjs/common';

import { Clock } from '../../shared/application/clock.js';
import { IdGenerator } from '../../shared/application/id-generator.js';
import { TransactionRunner } from '../../shared/application/transaction-runner.js';
import { CategoriesModule } from '../categories/categories.module.js';
import { CategoryRepository } from '../categories/domain/category.js';
import { HouseholdAccess } from '../households/application/household-access.js';
import { HouseholdsModule } from '../households/households.module.js';
import {
  CreateTransaction,
  DeleteTransaction,
  GetDailyTotals,
  GetMonthlySummary,
  GetTransaction,
  ListTransactions,
  UpdateTransaction,
} from './application/transactions.use-cases.js';
import { TransactionRepository } from './domain/transaction-repository.js';
import { DrizzleTransactionRepository } from './infrastructure/persistence/drizzle-transaction.repository.js';
import { TransactionsController } from './interface/http/transactions.controller.js';

/** Movements with their per-member shares, lists, monthly summary and daily totals. */
@Module({
  imports: [HouseholdsModule, CategoriesModule],
  controllers: [TransactionsController],
  providers: [
    { provide: TransactionRepository, useClass: DrizzleTransactionRepository },
    {
      provide: CreateTransaction,
      inject: [
        HouseholdAccess,
        TransactionRepository,
        CategoryRepository,
        TransactionRunner,
        Clock,
        IdGenerator,
      ],
      useFactory: (...deps: ConstructorParameters<typeof CreateTransaction>) =>
        new CreateTransaction(...deps),
    },
    {
      provide: UpdateTransaction,
      inject: [
        HouseholdAccess,
        TransactionRepository,
        CategoryRepository,
        TransactionRunner,
        Clock,
      ],
      useFactory: (...deps: ConstructorParameters<typeof UpdateTransaction>) =>
        new UpdateTransaction(...deps),
    },
    ...[GetTransaction, DeleteTransaction, ListTransactions, GetMonthlySummary, GetDailyTotals].map(
      (UseCase) => ({
        provide: UseCase,
        inject: [HouseholdAccess, TransactionRepository],
        useFactory: (access: HouseholdAccess, transactions: TransactionRepository) =>
          new UseCase(access, transactions),
      }),
    ),
  ],
  exports: [TransactionRepository],
})
export class TransactionsModule {}
