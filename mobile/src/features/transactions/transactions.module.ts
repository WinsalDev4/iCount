import type { DataSource } from '@/core/config/env';

import { InMemoryTransactionRepository } from './data/InMemoryTransactionRepository';
import type { TransactionRepository } from './domain/TransactionRepository';
import { GetMonthlySummary } from './domain/usecases/GetMonthlySummary';

export interface TransactionsModuleConfig {
  readonly dataSource: DataSource;
}

/**
 * Feature module: wires the transactions feature (repository → use cases) and
 * exposes only what presentation needs. Kotlin analogy: a Koin `module { }` or a
 * Hilt `@Module` scoped to one feature; the container just composes modules.
 */
export function createTransactionsModule({ dataSource }: TransactionsModuleConfig) {
  const repository = createRepository(dataSource);

  return {
    getMonthlySummary: new GetMonthlySummary(repository, 'EUR'),
  };
}

export type TransactionsModule = ReturnType<typeof createTransactionsModule>;

function createRepository(dataSource: DataSource): TransactionRepository {
  switch (dataSource) {
    case 'memory':
      return new InMemoryTransactionRepository();
    case 'api':
      // ApiTransactionRepository arrives with the transactions backend (phase 3, A-3.2).
      throw new Error('transactions: the "api" data source is not available yet');
  }
}
