import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { useDependencies } from '@/core/di/DependenciesProvider';
import { Money } from '@/core/domain/Money';
import type { YearMonth } from '@/core/domain/YearMonth';
import { queryKeys } from '@/core/query/queryKeys';
import { useCategories } from '@/features/categories/presentation/useCategories';
import { useActiveHousehold } from '@/features/household/presentation/households';
import { isFutureMonth, monthOf, shiftMonth } from '@/features/transactions/domain/monthGrid';

import type { Budget } from '../domain/Budget';
import {
  budgetProgress,
  sortByUrgency,
  summarizeBudgets,
  type BudgetStatus,
} from '../domain/budgetProgress';

export interface BudgetRow {
  readonly id: string;
  readonly categoryName: string;
  readonly limit: string;
  readonly spent: string;
  /** "Quedan 42,00 €" / "Te has pasado 5,00 €" */
  readonly statusLabel: string;
  /** 0..1 for the bar. */
  readonly ratio: number;
  readonly percent: number;
  readonly status: BudgetStatus;
}

export type BudgetsUiState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message: string }
  | {
      readonly status: 'ready';
      readonly monthLabel: string;
      readonly canGoNext: boolean;
      readonly isCurrentMonth: boolean;
      readonly total: Omit<BudgetRow, 'id' | 'categoryName'> | null;
      readonly rows: readonly BudgetRow[];
    };

const monthName = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' });
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** "Quedan 42,00 €" or, when over, "Te has pasado 5,00 €". */
export function remainingLabel(remaining: Money): string {
  return remaining.isNegative()
    ? `Te has pasado ${Money.ofMinor(-remaining.amountMinor, remaining.currency).format()}`
    : `Quedan ${remaining.format()}`;
}

export function toRow(budget: Budget, name: string): BudgetRow {
  const progress = budgetProgress(budget);
  return {
    id: budget.id,
    categoryName: name,
    limit: budget.limit.format(),
    spent: budget.spent.format(),
    statusLabel: remainingLabel(budget.remaining),
    ratio: progress.ratio,
    percent: progress.percent,
    status: progress.status,
  };
}

/**
 * ViewModel of the budgets list (screen 07-A "barras"): the month's budgets with progress, most
 * worrying first, a month total, and month navigation (never into the future).
 */
export function useBudgetsViewModel() {
  const { listBudgets } = useDependencies().budgets;
  const household = useActiveHousehold();
  const categories = useCategories(household?.id);
  const today = useMemo(() => new Date(), []);
  const [month, setMonth] = useState<YearMonth>(() => monthOf(today));

  const query = useQuery({
    queryKey: queryKeys.budgets.month(household?.id ?? '', month),
    queryFn: () => listBudgets.execute(household?.id ?? '', month),
    enabled: household !== undefined,
  });

  const names = useMemo(
    () => new Map((categories.data ?? []).map((c) => [c.id as string, c.name])),
    [categories.data],
  );

  const state = useMemo<BudgetsUiState>(() => {
    if (!household) return { status: 'loading' };
    if (query.isError) {
      return { status: 'error', message: 'No hemos podido cargar tus presupuestos.' };
    }
    if (!query.data) return { status: 'loading' };

    const budgets = sortByUrgency(query.data);
    const totals = summarizeBudgets(budgets, household.currency);
    return {
      status: 'ready',
      monthLabel: capitalize(monthName.format(new Date(month.year, month.month - 1, 1))),
      canGoNext: !isFutureMonth(shiftMonth(month, 1), today),
      isCurrentMonth: month.year === monthOf(today).year && month.month === monthOf(today).month,
      total:
        budgets.length === 0
          ? null
          : {
              limit: totals.limit.format(),
              spent: totals.spent.format(),
              statusLabel: remainingLabel(totals.remaining),
              ratio: totals.progress.ratio,
              percent: totals.progress.percent,
              status: totals.progress.status,
            },
      rows: budgets.map((b) => toRow(b, names.get(b.categoryId) ?? 'Sin categoría')),
    };
  }, [household, query.isError, query.data, month, today, names]);

  const previousMonth = useCallback(() => setMonth((m) => shiftMonth(m, -1)), []);
  const nextMonth = useCallback(
    () => setMonth((m) => (isFutureMonth(shiftMonth(m, 1), today) ? m : shiftMonth(m, 1))),
    [today],
  );

  return { state, previousMonth, nextMonth, month, refresh: query.refetch };
}
