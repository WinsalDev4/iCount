import { Module } from '@nestjs/common';

import { Clock } from '../../shared/application/clock.js';
import { IdGenerator } from '../../shared/application/id-generator.js';
import { TODAY } from '../../shared/application/today.js';
import { TransactionRunner } from '../../shared/application/transaction-runner.js';
import { CategoriesModule } from '../categories/categories.module.js';
import { CategoryRepository } from '../categories/domain/category.js';
import { ActivityLog } from '../activity/domain/activity.js';
import { DebtsModule } from '../debts/debts.module.js';
import { DebtRepository } from '../debts/domain/debt.js';
import { HouseholdAccess } from '../households/application/household-access.js';
import { HouseholdRepository } from '../households/domain/household.js';
import { HouseholdsModule } from '../households/households.module.js';
import { PushNotifications } from '../push/domain/push.js';
import { TransactionRepository } from '../transactions/domain/transaction-repository.js';
import { TransactionsModule } from '../transactions/transactions.module.js';
import {
  CreateRecurringPayment,
  DeleteRecurringPayment,
  ListRecurringPayments,
  ListUpcomingDues,
  MaterializeDueRecurringPayments,
  UpdateRecurringPayment,
} from './application/recurring.use-cases.js';
import { RecurringPaymentRepository } from './domain/recurring-payment.js';
import { DrizzleRecurringPaymentRepository } from './infrastructure/persistence/drizzle-recurring.repository.js';
import { RecurringScheduler } from './infrastructure/recurring.scheduler.js';
import { RecurringController } from './interface/http/recurring.controller.js';

/** Recurring payments, upcoming dues and the daily job that turns them into movements. */
@Module({
  imports: [HouseholdsModule, CategoriesModule, TransactionsModule, DebtsModule],
  controllers: [RecurringController],
  providers: [
    { provide: RecurringPaymentRepository, useClass: DrizzleRecurringPaymentRepository },
    {
      provide: CreateRecurringPayment,
      inject: [
        HouseholdAccess,
        RecurringPaymentRepository,
        CategoryRepository,
        Clock,
        IdGenerator,
        TODAY,
        DebtRepository,
      ],
      useFactory: (...deps: ConstructorParameters<typeof CreateRecurringPayment>) =>
        new CreateRecurringPayment(...deps),
    },
    {
      provide: UpdateRecurringPayment,
      inject: [HouseholdAccess, RecurringPaymentRepository, CategoryRepository, TODAY],
      useFactory: (...deps: ConstructorParameters<typeof UpdateRecurringPayment>) =>
        new UpdateRecurringPayment(...deps),
    },
    ...[ListRecurringPayments, DeleteRecurringPayment, ListUpcomingDues].map((UseCase) => ({
      provide: UseCase,
      inject: [HouseholdAccess, RecurringPaymentRepository],
      useFactory: (access: HouseholdAccess, payments: RecurringPaymentRepository) =>
        new UseCase(access, payments),
    })),
    {
      provide: MaterializeDueRecurringPayments,
      inject: [
        RecurringPaymentRepository,
        HouseholdRepository,
        TransactionRepository,
        TransactionRunner,
        Clock,
        IdGenerator,
        DebtRepository,
        ActivityLog,
        PushNotifications,
      ],
      useFactory: (...deps: ConstructorParameters<typeof MaterializeDueRecurringPayments>) =>
        new MaterializeDueRecurringPayments(...deps),
    },
    RecurringScheduler,
  ],
  exports: [MaterializeDueRecurringPayments],
})
export class RecurringModule {}
