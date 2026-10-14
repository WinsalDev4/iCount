import { DomainError } from '../../../shared/domain/domain-error.js';

/** Spending limit for one category in one month (`YYYY-MM`). */
export interface Budget {
  readonly id: string;
  readonly householdId: string;
  readonly categoryId: string;
  readonly month: string;
  /** Positive cents. */
  readonly limitMinor: number;
  readonly currency: string;
  readonly createdAt: Date;
}

/** A budget with what has been spent in its category that month (computed when read). */
export interface BudgetWithSpending extends Budget {
  readonly spentMinor: number;
}

export abstract class BudgetRepository {
  abstract listForMonth(householdId: string, month: string): Promise<BudgetWithSpending[]>;
  abstract findById(id: string): Promise<BudgetWithSpending | null>;
  /** False when the household already has a budget for that category and month. */
  abstract create(budget: Budget): Promise<boolean>;
  abstract updateLimit(id: string, limitMinor: number): Promise<void>;
  abstract delete(id: string): Promise<void>;
}

export class BudgetNotFoundError extends DomainError {
  readonly kind = 'not_found';
  readonly code = 'budget-not-found';
  readonly title = 'Budget not found';

  constructor(id: string) {
    super(`Budget ${id} does not exist or you cannot see it.`);
  }
}

export class DuplicateBudgetError extends DomainError {
  readonly kind = 'conflict';
  readonly code = 'duplicate-budget';
  readonly title = 'Budget already exists';

  constructor(categoryId: string, month: string) {
    super(`There is already a budget for ${categoryId} in ${month}. Edit it instead.`);
  }
}

export class InsufficientBudgetError extends DomainError {
  readonly kind = 'invalid';
  readonly code = 'insufficient-amount';
  readonly title = 'Not enough budget to move';

  constructor() {
    super('A budget cannot be left at zero or below: move a smaller amount.');
  }
}

export class InvalidBudgetMoveError extends DomainError {
  readonly kind = 'invalid';
  readonly code = 'invalid-budget-move';
  readonly title = 'Budgets cannot be combined';
}
