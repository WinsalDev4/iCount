import type { Money } from '@/core/domain/Money';

export type TransactionType = 'income' | 'expense';

export type CategoryId =
  | 'food'
  | 'bills'
  | 'housing'
  | 'transport'
  | 'loans'
  | 'insurance'
  | 'leisure'
  | 'salary'
  | 'other';

export interface Transaction {
  readonly id: string;
  readonly type: TransactionType;
  /** Always positive; the sign is given by `type`. */
  readonly amount: Money;
  readonly categoryId: CategoryId;
  readonly description: string;
  readonly occurredAt: Date;
  /** Shared economies (e.g. a couple) group transactions by household. */
  readonly householdId: string;
}

/** Year + 1-based month, e.g. { year: 2026, month: 10 }. */
export interface YearMonth {
  readonly year: number;
  readonly month: number;
}
