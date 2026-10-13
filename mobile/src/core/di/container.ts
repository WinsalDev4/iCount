import { env, type DataSource } from '@/core/config/env';
import { createAuthModule } from '@/features/auth/auth.module';
import { createHouseholdModule } from '@/features/household/household.module';
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
    household: createHouseholdModule(config),
    transactions: createTransactionsModule(config),
  };
}

export type Container = ReturnType<typeof createContainer>;
