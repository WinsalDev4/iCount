import type { DataSource } from '@/core/config/env';

import { InMemoryTransactionRepository } from './data/InMemoryTransactionRepository';
import type { TransactionRepository } from './domain/TransactionRepository';
import { CreateTransaction } from './domain/usecases/CreateTransaction';
import { GetDailyAllowance } from './domain/usecases/GetDailyAllowance';
import { GetMonthlySummary } from './domain/usecases/GetMonthlySummary';
import { GetRecentTransactions } from './domain/usecases/GetRecentTransactions';
import { GetWeeklySpending } from './domain/usecases/GetWeeklySpending';

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
    transactionRepository: repository,
    getMonthlySummary: new GetMonthlySummary(repository, 'EUR'),
    createTransaction: new CreateTransaction(repository),
    getDailyAllowance: new GetDailyAllowance(repository, 'EUR'),
    getWeeklySpending: new GetWeeklySpending(repository, 'EUR'),
    getRecentTransactions: new GetRecentTransactions(repository),
  };
}

export type TransactionsModule = ReturnType<typeof createTransactionsModule>;

function createRepository(dataSource: DataSource): TransactionRepository {
  switch (dataSource) {
    case 'memory':
      return new InMemoryTransactionRepository();
    case 'api':
      // ApiTransactionRepository exists (A-3.2); the container picks it in the 3.9 integration.
      throw new Error('transactions: the "api" data source is chosen in the 3.9 integration');
  }
}
