import type { RecurrenceRule } from '@icount/finance';

/**
 * What the advisor knows about a household: aggregates only (ADR-0020). No
 * movement descriptions, no emails or real names; every figure is computed by
 * deterministic code before the model sees anything.
 */
export interface HouseholdSnapshot {
  readonly householdId: string;
  readonly currency: string;
  /** Calendar day in the household's time zone (`YYYY-MM-DD`). */
  readonly today: string;
  /** Category id → display name. */
  readonly categoryNames: ReadonlyMap<string, string>;
  /** Expenses per category of the current month and the four before it. */
  readonly monthlyExpenses: readonly MonthlyCategoryExpense[];
  /** Budgets of the current month with what has been spent so far. */
  readonly budgets: readonly BudgetFigures[];
  /** Active recurring payments (with a next due date). */
  readonly recurring: readonly RecurringFigures[];
  readonly debts: readonly DebtFigures[];
}

export interface MonthlyCategoryExpense {
  /** `YYYY-MM`. */
  readonly month: string;
  readonly categoryId: string;
  readonly amountMinor: number;
}

export interface BudgetFigures {
  readonly id: string;
  readonly categoryId: string;
  readonly month: string;
  readonly limitMinor: number;
  readonly spentMinor: number;
}

export interface RecurringFigures {
  readonly id: string;
  readonly name: string;
  readonly kind: 'bill' | 'loan' | 'subscription' | 'income' | 'other';
  readonly type: 'income' | 'expense';
  readonly amountMinor: number;
  readonly categoryId: string;
  readonly rule: RecurrenceRule;
}

export interface DebtFigures {
  readonly id: string;
  readonly name: string;
  readonly outstandingMinor: number;
  readonly annualRateBps: number;
  readonly monthlyPaymentMinor: number;
}

/** `YYYY-MM` of a day, shifted by `delta` months. */
export function monthOf(day: string, delta = 0): string {
  const [year, month] = day.split('-').map(Number) as [number, number];
  const index = year * 12 + (month - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}
