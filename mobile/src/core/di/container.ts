import { env, type DataSource } from '@/core/config/env';
import { createActivityModule } from '@/features/activity/activity.module';
import { createAuthModule } from '@/features/auth/auth.module';
import { createBudgetsModule } from '@/features/budgets/budgets.module';
import { createCategoriesModule } from '@/features/categories/categories.module';
import { createDebtsModule } from '@/features/debts/debts.module';
import { createHouseholdModule } from '@/features/household/household.module';
import { createPushModule } from '@/features/push/push.module';
import { createRecurringModule } from '@/features/recurring/recurring.module';
import { createSettlementsModule } from '@/features/settlements/settlements.module';
import { createTransactionsModule } from '@/features/transactions/transactions.module';

export interface ContainerConfig {
  readonly dataSource: DataSource;
}

/**
 * Composition root: composes one module per feature, each namespaced by feature name.
 * Equivalent to the list of Hilt/Koin modules on Android. See docs/adr/0003-arquitectura-clean-mvvm.md
 */
export function createContainer(config: ContainerConfig = { dataSource: env.dataSource }) {
  return {
    activity: createActivityModule(config),
    auth: createAuthModule(config),
    budgets: createBudgetsModule(config),
    categories: createCategoriesModule(config),
    debts: createDebtsModule(config),
    household: createHouseholdModule(config),
    push: createPushModule(config),
    recurring: createRecurringModule(config),
    settlements: createSettlementsModule(config),
    transactions: createTransactionsModule(config),
  };
}

export type Container = ReturnType<typeof createContainer>;
