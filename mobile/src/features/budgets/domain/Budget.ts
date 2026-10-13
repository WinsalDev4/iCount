import type { CategoryId } from '@/core/domain/Category';
import type { Money } from '@/core/domain/Money';
import type { YearMonth } from '@/core/domain/YearMonth';

/** Spending limit for one category in one month, with its progress. */
export interface Budget {
  readonly id: string;
  readonly householdId: string;
  readonly categoryId: CategoryId;
  readonly month: YearMonth;
  readonly limit: Money;
  readonly spent: Money;
  /** `limit − spent`; negative when exceeded. */
  readonly remaining: Money;
}

export interface NewBudget {
  readonly householdId: string;
  readonly categoryId: CategoryId;
  readonly month: YearMonth;
  readonly limit: Money;
}
