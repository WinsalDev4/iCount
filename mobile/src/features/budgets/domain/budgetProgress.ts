import { Money, type CurrencyCode } from '@/core/domain/Money';

import type { Budget } from './Budget';

/** From calm to alarming. "warning" starts at 80 % of the limit. */
export type BudgetStatus = 'ok' | 'warning' | 'exceeded';

export const WARNING_THRESHOLD_BASIS_POINTS = 8_000;

export interface BudgetProgress {
  /** spent ÷ limit, 0..1 for the bar (an exceeded budget draws as full). */
  readonly ratio: number;
  /** Percentage as a whole number for the label: 0, 37, 100, 125 (not clamped). */
  readonly percent: number;
  readonly status: BudgetStatus;
}

/** How full a budget is. Integer cents only: a limit of 0 counts as exceeded as soon as anything is spent. */
export function budgetProgress(budget: Pick<Budget, 'limit' | 'spent'>): BudgetProgress {
  const limit = budget.limit.amountMinor;
  const spent = budget.spent.amountMinor;

  if (limit <= 0) {
    return {
      ratio: spent > 0 ? 1 : 0,
      percent: spent > 0 ? 100 : 0,
      status: spent > 0 ? 'exceeded' : 'ok',
    };
  }

  const basisPoints = Math.floor((spent * 10_000) / limit);
  return {
    ratio: Math.min(1, Math.max(0, spent / limit)),
    percent: Math.floor(basisPoints / 100),
    status:
      spent > limit ? 'exceeded' : basisPoints >= WARNING_THRESHOLD_BASIS_POINTS ? 'warning' : 'ok',
  };
}

export interface BudgetTotals {
  readonly limit: Money;
  readonly spent: Money;
  /** limit − spent; negative when the month as a whole went over. */
  readonly remaining: Money;
  readonly progress: BudgetProgress;
}

/** Totals over all the budgets of a month. */
export function summarizeBudgets(
  budgets: readonly Pick<Budget, 'limit' | 'spent'>[],
  currency: CurrencyCode,
): BudgetTotals {
  let limit = Money.zero(currency);
  let spent = Money.zero(currency);
  for (const budget of budgets) {
    limit = limit.plus(budget.limit);
    spent = spent.plus(budget.spent);
  }
  return {
    limit,
    spent,
    remaining: limit.minus(spent),
    progress: budgetProgress({ limit, spent }),
  };
}

/** Most worrying first: exceeded, then by how full they are. */
export function sortByUrgency<T extends Pick<Budget, 'limit' | 'spent'>>(
  budgets: readonly T[],
): T[] {
  return [...budgets].sort((a, b) => {
    const pa = budgetProgress(a);
    const pb = budgetProgress(b);
    const exceeded = Number(pb.status === 'exceeded') - Number(pa.status === 'exceeded');
    return exceeded || pb.ratio - pa.ratio;
  });
}
