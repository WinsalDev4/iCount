import type { Money } from '@/core/domain/Money';
import type { YearMonth } from '@/core/domain/YearMonth';

import type { Budget, NewBudget } from '../Budget';
import { BudgetError } from '../BudgetError';
import type { BudgetRepository } from '../BudgetRepository';

/** The budgets of one month. */
export class ListBudgets {
  constructor(private readonly repository: Pick<BudgetRepository, 'list'>) {}

  execute(householdId: string, month: YearMonth): Promise<readonly Budget[]> {
    return this.repository.list(householdId, month);
  }
}

/** One budget per category and month; the limit must be above zero. */
export class CreateBudget {
  constructor(private readonly repository: Pick<BudgetRepository, 'create'>) {}

  execute(input: NewBudget): Promise<Budget> {
    if (input.limit.amountMinor <= 0) return Promise.reject(new BudgetError('invalid'));
    return this.repository.create(input);
  }
}

export class UpdateBudgetLimit {
  constructor(private readonly repository: Pick<BudgetRepository, 'updateLimit'>) {}

  execute(id: string, limit: Money): Promise<Budget> {
    if (limit.amountMinor <= 0) return Promise.reject(new BudgetError('invalid'));
    return this.repository.updateLimit(id, limit);
  }
}

export class DeleteBudget {
  constructor(private readonly repository: Pick<BudgetRepository, 'delete'>) {}

  execute(id: string): Promise<void> {
    return this.repository.delete(id);
  }
}

/**
 * Moves part of the limit of one budget to another of the same month ("I overspent on food,
 * take 50 € from leisure"). Spending is untouched; only the limits change.
 */
export class MoveBudgetAmount {
  constructor(private readonly repository: Pick<BudgetRepository, 'moveAmount'>) {}

  execute(fromId: string, toId: string, amount: Money): Promise<readonly [Budget, Budget]> {
    if (fromId === toId || amount.amountMinor <= 0) {
      return Promise.reject(new BudgetError('invalid'));
    }
    return this.repository.moveAmount(fromId, toId, amount);
  }
}
