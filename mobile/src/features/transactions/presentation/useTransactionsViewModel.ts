import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useDependencies } from '@/core/di/DependenciesProvider';

import type { YearMonth } from '../domain/Transaction';

export interface CategoryRow {
  readonly categoryId: string;
  readonly amount: string;
}

export type TransactionsUiState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message: string }
  | {
      readonly status: 'success';
      readonly income: string;
      readonly expenses: string;
      readonly balance: string;
      readonly isOverspent: boolean;
      readonly categories: readonly CategoryRow[];
    };

/**
 * ViewModel as a custom hook (MVVM): exposes immutable UI state and actions,
 * hides use cases and formatting from the View.
 * Kotlin analogy: a ViewModel exposing StateFlow<UiState>.
 */
export function useTransactionsViewModel(householdId: string, period: YearMonth) {
  const { getMonthlySummary } = useDependencies().transactions;

  const query = useQuery({
    queryKey: ['monthly-summary', householdId, period.year, period.month],
    queryFn: () => getMonthlySummary.execute(householdId, period),
  });

  const state = useMemo<TransactionsUiState>(() => {
    if (query.isPending) return { status: 'loading' };
    if (query.isError) return { status: 'error', message: query.error.message };
    const summary = query.data;
    return {
      status: 'success',
      income: summary.income.format(),
      expenses: summary.expenses.format(),
      balance: summary.balance.format(),
      isOverspent: summary.balance.isNegative(),
      categories: [...summary.expensesByCategory]
        .sort(([, a], [, b]) => b.amountMinor - a.amountMinor)
        .map(([categoryId, amount]) => ({ categoryId, amount: amount.format() })),
    };
  }, [query.isPending, query.isError, query.error, query.data]);

  return { state, refresh: query.refetch };
}
