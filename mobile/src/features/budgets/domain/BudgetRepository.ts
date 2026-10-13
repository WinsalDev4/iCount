import type { Money } from '@/core/domain/Money';
import type { YearMonth } from '@/core/domain/YearMonth';

import type { Budget, NewBudget } from './Budget';

/**
 * Port for budgets (one per category and month). Implementations:
 * InMemoryBudgetRepository (B-4.1) and ApiBudgetRepository (A-4.3).
 * Failures reject with `BudgetError`.
 */
export interface BudgetRepository {
  list(householdId: string, month: YearMonth): Promise<readonly Budget[]>;
  create(input: NewBudget): Promise<Budget>;
  updateLimit(id: string, limit: Money): Promise<Budget>;
  delete(id: string): Promise<void>;
  /** Moves part of one budget's limit to another of the same month. */
  moveAmount(fromId: string, toId: string, amount: Money): Promise<readonly [Budget, Budget]>;
}
