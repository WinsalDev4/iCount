import { type FeatureContext, requireApi } from '@/core/di/FeatureContext';

import { ApiTransactionRepository } from './data/api/ApiTransactionRepository';
import { sharedMemoryTransactionRepository } from './data/sharedMemoryRepository';
import type { TransactionRepository } from './domain/TransactionRepository';
import { CreateTransaction } from './domain/usecases/CreateTransaction';
import {
  DeleteTransaction,
  GetDailyTotals,
  GetTransaction,
  ListTransactions,
  UpdateTransaction,
} from './domain/usecases/TransactionUseCases';
import { GetDailyAllowance } from './domain/usecases/GetDailyAllowance';
import { GetMonthlySummary } from './domain/usecases/GetMonthlySummary';
import { GetRecentTransactions } from './domain/usecases/GetRecentTransactions';
import { GetWeeklySpending } from './domain/usecases/GetWeeklySpending';

/**
 * Feature module: wires the transactions feature (repository → use cases) and
 * exposes only what presentation needs. Kotlin analogy: a Koin `module { }` or a
 * Hilt `@Module` scoped to one feature; the container just composes modules.
 */
export function createTransactionsModule(context: FeatureContext) {
  const repository = createRepository(context);

  return {
    transactionRepository: repository,
    getMonthlySummary: new GetMonthlySummary(repository, 'EUR'),
    createTransaction: new CreateTransaction(repository),
    getDailyAllowance: new GetDailyAllowance(repository, 'EUR'),
    getWeeklySpending: new GetWeeklySpending(repository, 'EUR'),
    getRecentTransactions: new GetRecentTransactions(repository),
    listTransactions: new ListTransactions(repository),
    getTransaction: new GetTransaction(repository),
    getDailyTotals: new GetDailyTotals(repository),
    updateTransaction: new UpdateTransaction(repository),
    deleteTransaction: new DeleteTransaction(repository),
  };
}

export type TransactionsModule = ReturnType<typeof createTransactionsModule>;

function createRepository(context: FeatureContext): TransactionRepository {
  switch (context.dataSource) {
    case 'memory':
      return sharedMemoryTransactionRepository();
    case 'api':
      return new ApiTransactionRepository(requireApi(context, 'transactions').http);
  }
}
