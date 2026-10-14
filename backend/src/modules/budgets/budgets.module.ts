import { Module } from '@nestjs/common';

import { Clock } from '../../shared/application/clock.js';
import { IdGenerator } from '../../shared/application/id-generator.js';
import { TransactionRunner } from '../../shared/application/transaction-runner.js';
import { CategoriesModule } from '../categories/categories.module.js';
import { CategoryRepository } from '../categories/domain/category.js';
import { HouseholdAccess } from '../households/application/household-access.js';
import { HouseholdsModule } from '../households/households.module.js';
import {
  CreateBudget,
  DeleteBudget,
  ListBudgets,
  MoveBudgetAmount,
  UpdateBudgetLimit,
} from './application/budgets.use-cases.js';
import { BudgetRepository } from './domain/budget.js';
import { DrizzleBudgetRepository } from './infrastructure/persistence/drizzle-budget.repository.js';
import { BudgetsController } from './interface/http/budgets.controller.js';

/** Monthly budgets per category with live spending. */
@Module({
  imports: [HouseholdsModule, CategoriesModule],
  controllers: [BudgetsController],
  providers: [
    { provide: BudgetRepository, useClass: DrizzleBudgetRepository },
    {
      provide: CreateBudget,
      inject: [HouseholdAccess, BudgetRepository, CategoryRepository, Clock, IdGenerator],
      useFactory: (...deps: ConstructorParameters<typeof CreateBudget>) =>
        new CreateBudget(...deps),
    },
    {
      provide: MoveBudgetAmount,
      inject: [HouseholdAccess, BudgetRepository, TransactionRunner],
      useFactory: (...deps: ConstructorParameters<typeof MoveBudgetAmount>) =>
        new MoveBudgetAmount(...deps),
    },
    ...[ListBudgets, UpdateBudgetLimit, DeleteBudget].map((UseCase) => ({
      provide: UseCase,
      inject: [HouseholdAccess, BudgetRepository],
      useFactory: (access: HouseholdAccess, budgets: BudgetRepository) =>
        new UseCase(access, budgets),
    })),
  ],
})
export class BudgetsModule {}
