import { env, type DataSource } from '@/core/config/env';
import { createAuthModule } from '@/features/auth/auth.module';
import { createBudgetsModule } from '@/features/budgets/budgets.module';
import { createCategoriesModule } from '@/features/categories/categories.module';
import { createDebtsModule } from '@/features/debts/debts.module';
import { createHouseholdModule } from '@/features/household/household.module';
import { createRecurringModule } from '@/features/recurring/recurring.module';
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
    auth: createAuthModule(config),
    budgets: createBudgetsModule(config),
    categories: createCategoriesModule(config),
    debts: createDebtsModule(config),
    household: createHouseholdModule(config),
    recurring: createRecurringModule(config),
    transactions: createTransactionsModule(config),
  };
}

export type Container = ReturnType<typeof createContainer>;
