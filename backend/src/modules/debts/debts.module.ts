import { Module } from '@nestjs/common';

import { Clock } from '../../shared/application/clock.js';
import { IdGenerator } from '../../shared/application/id-generator.js';
import { TODAY } from '../../shared/application/today.js';
import { HouseholdAccess } from '../households/application/household-access.js';
import { HouseholdsModule } from '../households/households.module.js';
import { TransactionRepository } from '../transactions/domain/transaction-repository.js';
import { TransactionsModule } from '../transactions/transactions.module.js';
import {
  CreateDebt,
  DeleteDebt,
  GetDebt,
  LinkDebtPayment,
  ListDebtPayments,
  ListDebts,
  PlanDebtPayoff,
  UnlinkDebtPayment,
  UpdateDebt,
} from './application/debts.use-cases.js';
import { DebtRepository } from './domain/debt.js';
import { DrizzleDebtRepository } from './infrastructure/persistence/drizzle-debt.repository.js';
import { DebtsController } from './interface/http/debts.controller.js';

/** Loans with French amortisation, their payments and payoff strategies. */
@Module({
  imports: [HouseholdsModule, TransactionsModule],
  controllers: [DebtsController],
  providers: [
    { provide: DebtRepository, useClass: DrizzleDebtRepository },
    {
      provide: CreateDebt,
      inject: [HouseholdAccess, DebtRepository, Clock, IdGenerator],
      useFactory: (...deps: ConstructorParameters<typeof CreateDebt>) => new CreateDebt(...deps),
    },
    {
      provide: PlanDebtPayoff,
      inject: [HouseholdAccess, DebtRepository, TODAY],
      useFactory: (...deps: ConstructorParameters<typeof PlanDebtPayoff>) =>
        new PlanDebtPayoff(...deps),
    },
    ...[LinkDebtPayment, ListDebtPayments].map((UseCase) => ({
      provide: UseCase,
      inject: [HouseholdAccess, DebtRepository, TransactionRepository],
      useFactory: (
        access: HouseholdAccess,
        debts: DebtRepository,
        transactions: TransactionRepository,
      ) => new UseCase(access, debts, transactions),
    })),
    ...[ListDebts, GetDebt, UpdateDebt, DeleteDebt, UnlinkDebtPayment].map((UseCase) => ({
      provide: UseCase,
      inject: [HouseholdAccess, DebtRepository],
      useFactory: (access: HouseholdAccess, debts: DebtRepository) => new UseCase(access, debts),
    })),
  ],
  exports: [DebtRepository],
})
export class DebtsModule {}
