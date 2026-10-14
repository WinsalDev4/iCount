import { type ApiClients, createApiClients } from '@/core/auth/createApiClients';
import { env, type DataSource } from '@/core/config/env';
import { createActivityModule } from '@/features/activity/activity.module';
import { createAdvisorModule } from '@/features/advisor/advisor.module';
import { createAuthModule } from '@/features/auth/auth.module';
import { createBudgetsModule } from '@/features/budgets/budgets.module';
import { createCategoriesModule } from '@/features/categories/categories.module';
import { createDebtsModule } from '@/features/debts/debts.module';
import { createHouseholdModule } from '@/features/household/household.module';
import { createPushModule } from '@/features/push/push.module';
import { createRecurringModule } from '@/features/recurring/recurring.module';
import { createSettlementsModule } from '@/features/settlements/settlements.module';
import { createTransactionsModule } from '@/features/transactions/transactions.module';

import type { FeatureContext } from './FeatureContext';

export interface ContainerConfig {
  readonly dataSource: DataSource;
  /** Defaults to `env.apiUrl`; only used with the `api` data source. */
  readonly apiUrl?: string;
  /** Injected in tests; otherwise created once here. */
  readonly api?: ApiClients;
}

/**
 * Composition root: composes one module per feature, each namespaced by feature name.
 * Equivalent to the list of Hilt/Koin modules on Android. See docs/adr/0003-arquitectura-clean-mvvm.md
 */
export function createContainer(config: ContainerConfig = { dataSource: env.dataSource }) {
  const context: FeatureContext = {
    dataSource: config.dataSource,
    api:
      config.dataSource === 'api'
        ? (config.api ?? createApiClients({ baseUrl: config.apiUrl ?? env.apiUrl }))
        : null,
  };
  return {
    /** The device session (ADR-0013); null with the in-memory data source. */
    session: context.api?.session ?? null,
    activity: createActivityModule(context),
    advisor: createAdvisorModule(context),
    auth: createAuthModule(context),
    budgets: createBudgetsModule(context),
    categories: createCategoriesModule(context),
    debts: createDebtsModule(context),
    household: createHouseholdModule(context),
    push: createPushModule(context),
    recurring: createRecurringModule(context),
    settlements: createSettlementsModule(context),
    transactions: createTransactionsModule(context),
  };
}

export type Container = ReturnType<typeof createContainer>;
