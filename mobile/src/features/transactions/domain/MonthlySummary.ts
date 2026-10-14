import type { Money } from '@/core/domain/Money';

import type { CategoryId } from './Transaction';

export interface MonthlySummary {
  readonly income: Money;
  readonly expenses: Money;
  readonly balance: Money;
  readonly expensesByCategory: ReadonlyMap<CategoryId, Money>;
}
