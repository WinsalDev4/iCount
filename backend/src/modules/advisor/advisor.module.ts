import Anthropic from '@anthropic-ai/sdk';
import { Module } from '@nestjs/common';

import { Clock } from '../../shared/application/clock.js';
import { IdGenerator } from '../../shared/application/id-generator.js';
import { startOfDayIn, TODAY, type Today } from '../../shared/application/today.js';
import { TransactionRunner } from '../../shared/application/transaction-runner.js';
import { APP_CONFIG, type AppConfig } from '../../shared/config/app-config.js';
import { BudgetsModule } from '../budgets/budgets.module.js';
import { BudgetRepository } from '../budgets/domain/budget.js';
import { CategoriesModule } from '../categories/categories.module.js';
import { CategoryRepository } from '../categories/domain/category.js';
import { DebtsModule } from '../debts/debts.module.js';
import { DebtRepository } from '../debts/domain/debt.js';
import { HouseholdAccess } from '../households/application/household-access.js';
import { HouseholdsModule } from '../households/households.module.js';
import { RecurringPaymentRepository } from '../recurring/domain/recurring-payment.js';
import { RecurringModule } from '../recurring/recurring.module.js';
import { TransactionRepository } from '../transactions/domain/transaction-repository.js';
import { TransactionsModule } from '../transactions/transactions.module.js';
import {
  GetAdvisorConsent,
  RecordAppliedAction,
  SetAdvisorConsent,
  StartAdvisorChat,
} from './application/advisor.use-cases.js';
import { BuildInsightsReport, GetInsights } from './application/insights.use-cases.js';
import { ReadHouseholdSnapshot } from './application/read-snapshot.js';
import { AdvisorModel, AdvisorRepository } from './domain/advisor.js';
import { AdvisorScheduler } from './infrastructure/advisor.scheduler.js';
import { ClaudeAdvisorModel } from './infrastructure/claude-advisor-model.js';
import { DrizzleAdvisorRepository } from './infrastructure/persistence/drizzle-advisor.repository.js';
import { AdvisorController } from './interface/http/advisor.controller.js';

/** AI advisor (ADR-0020): deterministic findings, Claude for wording and chat. */
@Module({
  imports: [
    HouseholdsModule,
    TransactionsModule,
    BudgetsModule,
    RecurringModule,
    DebtsModule,
    CategoriesModule,
  ],
  controllers: [AdvisorController],
  providers: [
    { provide: AdvisorRepository, useClass: DrizzleAdvisorRepository },
    {
      provide: AdvisorModel,
      inject: [APP_CONFIG],
      // Only the backend holds the key; without it the advisor degrades gracefully.
      useFactory: (config: AppConfig) =>
        new ClaudeAdvisorModel(
          config.advisor.anthropicApiKey
            ? new Anthropic({ apiKey: config.advisor.anthropicApiKey })
            : null,
        ),
    },
    {
      provide: ReadHouseholdSnapshot,
      inject: [
        TransactionRepository,
        BudgetRepository,
        RecurringPaymentRepository,
        DebtRepository,
        CategoryRepository,
      ],
      useFactory: (...deps: ConstructorParameters<typeof ReadHouseholdSnapshot>) =>
        new ReadHouseholdSnapshot(...deps),
    },
    {
      provide: BuildInsightsReport,
      inject: [ReadHouseholdSnapshot, AdvisorRepository, AdvisorModel, Clock, IdGenerator, TODAY],
      useFactory: (...deps: ConstructorParameters<typeof BuildInsightsReport>) =>
        new BuildInsightsReport(...deps),
    },
    {
      provide: GetInsights,
      inject: [HouseholdAccess, AdvisorRepository, BuildInsightsReport],
      useFactory: (...deps: ConstructorParameters<typeof GetInsights>) => new GetInsights(...deps),
    },
    {
      provide: GetAdvisorConsent,
      inject: [AdvisorRepository],
      useFactory: (advisor: AdvisorRepository) => new GetAdvisorConsent(advisor),
    },
    {
      provide: SetAdvisorConsent,
      inject: [AdvisorRepository, TransactionRunner, Clock],
      useFactory: (...deps: ConstructorParameters<typeof SetAdvisorConsent>) =>
        new SetAdvisorConsent(...deps),
    },
    {
      provide: RecordAppliedAction,
      inject: [HouseholdAccess, AdvisorRepository, Clock, IdGenerator],
      useFactory: (...deps: ConstructorParameters<typeof RecordAppliedAction>) =>
        new RecordAppliedAction(...deps),
    },
    {
      provide: StartAdvisorChat,
      inject: [
        HouseholdAccess,
        AdvisorRepository,
        AdvisorModel,
        ReadHouseholdSnapshot,
        Clock,
        IdGenerator,
        TODAY,
        APP_CONFIG,
      ],
      useFactory: (
        access: HouseholdAccess,
        advisor: AdvisorRepository,
        model: AdvisorModel,
        snapshots: ReadHouseholdSnapshot,
        clock: Clock,
        ids: IdGenerator,
        today: Today,
        config: AppConfig,
      ) =>
        new StartAdvisorChat(
          access,
          advisor,
          model,
          snapshots,
          clock,
          ids,
          today,
          config.advisor.dailyChatQuota,
          () => startOfDayIn(today()),
        ),
    },
    AdvisorScheduler,
  ],
})
export class AdvisorModule {}
