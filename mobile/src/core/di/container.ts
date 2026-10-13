import { InMemoryTransactionRepository } from '@/features/transactions/data/InMemoryTransactionRepository';
import { GetMonthlySummary } from '@/features/transactions/domain/usecases/GetMonthlySummary';

/**
 * Composition root: the only place that knows concrete implementations.
 * Equivalent to a Hilt/Koin module on Android. See docs/adr/0003-arquitectura-clean-mvvm.md
 */
export function createContainer() {
  const transactionRepository = new InMemoryTransactionRepository();

  return {
    getMonthlySummary: new GetMonthlySummary(transactionRepository, 'EUR'),
  };
}

export type Container = ReturnType<typeof createContainer>;
