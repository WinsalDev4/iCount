import { type DynamicModule, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';

import { AuthModule } from './modules/auth/auth.module.js';
import { BudgetsModule } from './modules/budgets/budgets.module.js';
import { CategoriesModule } from './modules/categories/categories.module.js';
import { DebtsModule } from './modules/debts/debts.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { HouseholdsModule } from './modules/households/households.module.js';
import { NotesModule } from './modules/notes/notes.module.js';
import { RecurringModule } from './modules/recurring/recurring.module.js';
import { TransactionsModule } from './modules/transactions/transactions.module.js';
import { SharedKernelModule } from './shared/application/shared-kernel.module.js';
import { AuthCoreModule } from './shared/auth/auth-core.module.js';
import { JwtAuthGuard } from './shared/auth/jwt-auth.guard.js';
import type { AppConfig } from './shared/config/app-config.js';
import { ConfigModule } from './shared/config/config.module.js';
import { DatabaseModule } from './shared/database/database.module.js';
import { EmailModule } from './shared/email/email.module.js';
import { ProblemDetailsFilter } from './shared/interface/http/problem-details.filter.js';
import { createLoggerModule } from './shared/logging/logger.module.js';

/**
 * Root module. It receives the already-validated config, so nothing starts
 * with a bad environment (Spring analogy: the @SpringBootApplication class).
 */
@Module({})
export class AppModule {
  static forRoot(config: AppConfig): DynamicModule {
    const featureModules = [
      HealthModule,
      AuthModule,
      HouseholdsModule,
      CategoriesModule,
      TransactionsModule,
      BudgetsModule,
      RecurringModule,
      DebtsModule,
      // The template module is a reference for new modules, not a product feature.
      ...(config.nodeEnv === 'production' ? [] : [NotesModule]),
    ];

    return {
      module: AppModule,
      imports: [
        ConfigModule.forRoot(config),
        createLoggerModule(config),
        DatabaseModule,
        SharedKernelModule,
        AuthCoreModule,
        EmailModule,
        // Cron jobs (recurring payments). Not started in tests: they call the jobs directly.
        ...(config.nodeEnv === 'test' ? [] : [ScheduleModule.forRoot()]),
        ...featureModules,
      ],
      providers: [
        { provide: APP_FILTER, useClass: ProblemDetailsFilter },
        // Secure by default: every route needs a token unless marked @Public().
        { provide: APP_GUARD, useClass: JwtAuthGuard },
      ],
    };
  }
}
