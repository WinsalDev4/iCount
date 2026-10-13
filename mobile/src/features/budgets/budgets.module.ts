import type { DataSource } from '@/core/config/env';
import { notImplemented } from '@/core/di/notImplemented';

import type { BudgetRepository } from './domain/BudgetRepository';

export interface BudgetsModuleConfig {
  readonly dataSource: DataSource;
}

/**
 * Stub from the global preparation (G.0, phase 4) so the container already
 * composes it. Phase 4 tasks fill in the in-memory and API implementations.
 */
export function createBudgetsModule(config: BudgetsModuleConfig) {
  return {
    budgetRepository: notImplemented<BudgetRepository>(
      `budgets(${config.dataSource}).budgetRepository`,
    ),
  };
}

export type BudgetsModule = ReturnType<typeof createBudgetsModule>;
