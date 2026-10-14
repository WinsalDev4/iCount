import type { DataSource } from '@/core/config/env';
import { notImplemented } from '@/core/di/notImplemented';
import { sharedMemoryTransactionRepository } from '@/features/transactions/data/sharedMemoryRepository';

import { InMemoryBudgetRepository } from './data/InMemoryBudgetRepository';
import type { BudgetRepository } from './domain/BudgetRepository';
import {
  CreateBudget,
  DeleteBudget,
  ListBudgets,
  MoveBudgetAmount,
  UpdateBudgetLimit,
} from './domain/usecases/BudgetUseCases';

export interface BudgetsModuleConfig {
  readonly dataSource: DataSource;
}

/**
 * Feature module: repository → use cases. `memory` computes "spent" from the shared in-memory
 * movements; the `api` source is chosen in the 4.9 integration (needs the authenticated client).
 */
export function createBudgetsModule(config: BudgetsModuleConfig) {
  const repository: BudgetRepository =
    config.dataSource === 'memory'
      ? new InMemoryBudgetRepository(sharedMemoryTransactionRepository())
      : notImplemented<BudgetRepository>(`budgets(${config.dataSource}).budgetRepository`);

  return {
    budgetRepository: repository,
    listBudgets: new ListBudgets(repository),
    createBudget: new CreateBudget(repository),
    updateBudgetLimit: new UpdateBudgetLimit(repository),
    deleteBudget: new DeleteBudget(repository),
    moveBudgetAmount: new MoveBudgetAmount(repository),
  };
}

export type BudgetsModule = ReturnType<typeof createBudgetsModule>;
