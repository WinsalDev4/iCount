import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { useDependencies } from '@/core/di/DependenciesProvider';
import { Money } from '@/core/domain/Money';
import type { YearMonth } from '@/core/domain/YearMonth';
import { queryKeys } from '@/core/query/queryKeys';
import { useCategories } from '@/features/categories/presentation/useCategories';
import { useActiveHousehold } from '@/features/household/presentation/households';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';

import { isSameDay, startOfDay } from '../../domain/calendar';
import { intensityByDay, type Intensity } from '../../domain/heatmap';
import {
  buildMonthGrid,
  isFutureMonth,
  isSameMonth,
  monthOf,
  shiftMonth,
} from '../../domain/monthGrid';
import type { Transaction, TransactionFilters, TransactionType } from '../../domain/Transaction';

export type TypeFilter = 'all' | TransactionType;

export interface DayCell {
  readonly key: string;
  readonly date: Date;
  readonly day: number;
  readonly intensity: Intensity;
  readonly selected: boolean;
  readonly isToday: boolean;
  /** "lunes 12: 25,00 € gastados" */
  readonly accessibilityLabel: string;
}

export interface HistoryRow {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  /** "-12,50 €" / "+1.925,00 €" */
  readonly amount: string;
  readonly tone: 'income' | 'expense';
}

export type HistoryListStatus = 'loading' | 'ready' | 'error';

export type HistoryUiState =
  | { readonly status: 'loading' }
  | {
      readonly status: 'ready';
      /** "octubre de 2026" */
      readonly monthLabel: string;
      readonly canGoNext: boolean;
      readonly weekdays: readonly string[];
      /** Weeks of seven cells; `null` pads the days outside the month. */
      readonly weeks: readonly (readonly (DayCell | null)[])[];
      readonly monthIncome: string;
      readonly monthExpenses: string;
      readonly searchText: string;
      readonly typeFilter: TypeFilter;
      readonly sharedOnly: boolean;
      /** A search or filter is on: the list shows matches from ALL dates, not the selected day. */
      readonly filtering: boolean;
      /** "miércoles, 14 de octubre" or "Resultados". */
      readonly heading: string;
      readonly rows: readonly HistoryRow[];
      readonly listStatus: HistoryListStatus;
      readonly hasMore: boolean;
      readonly loadingMore: boolean;
    };

const monthName = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' });
const dayHeading = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const dayShort = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric' });
const dayMonth = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });
const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const;
const PAGE_SIZE = 20;

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * ViewModel of Historial (screen 06-B "calendario"): a month heat map, the movements of the
 * selected day below it, and a search / filters that switch the list to matches from every date.
 */
export function useHistoryViewModel() {
  const { getDailyTotals, listTransactions } = useDependencies().transactions;
  const household = useActiveHousehold();
  const householdId = household?.id ?? '';
  const categories = useCategories(household?.id);
  const today = useMemo(() => startOfDay(new Date()), []);

  const [month, setMonth] = useState<YearMonth>(() => monthOf(today));
  const [selectedDay, setSelectedDay] = useState<Date>(today);
  const [searchText, setSearchText] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [sharedOnly, setSharedOnly] = useState(false);

  const query = useDebouncedValue(searchText.trim(), 300);
  const filtering = query !== '' || typeFilter !== 'all' || sharedOnly;

  const totals = useQuery({
    queryKey: queryKeys.transactions.dailyTotals(householdId, month),
    queryFn: () => getDailyTotals.execute(householdId, month),
    enabled: household !== undefined,
  });

  const filters = useMemo<TransactionFilters>(
    () =>
      filtering
        ? {
            ...(query !== '' && { query }),
            ...(typeFilter !== 'all' && { type: typeFilter }),
            ...(sharedOnly && { shared: true }),
          }
        : { from: selectedDay, to: selectedDay },
    [filtering, query, typeFilter, sharedOnly, selectedDay],
  );

  const list = useInfiniteQuery({
    queryKey: queryKeys.transactions.list(householdId, { ...filters, history: true }),
    queryFn: ({ pageParam }) =>
      listTransactions.execute(householdId, filters, { cursor: pageParam, limit: PAGE_SIZE }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: household !== undefined,
  });

  const categoryName = useMemo(
    () => new Map((categories.data ?? []).map((c) => [c.id as string, c.name])),
    [categories.data],
  );

  const intensity = useMemo(() => intensityByDay(totals.data ?? []), [totals.data]);
  const spentByDay = useMemo(
    () => new Map((totals.data ?? []).map((t) => [t.date.getDate(), t.expenses])),
    [totals.data],
  );

  const state = useMemo<HistoryUiState>(() => {
    if (!household) return { status: 'loading' };
    const currency = household.currency;

    const weeks = buildMonthGrid(month).map((week) =>
      week.map((date): DayCell | null => {
        if (!date) return null;
        const spent = spentByDay.get(date.getDate());
        return {
          key: date.toISOString(),
          date,
          day: date.getDate(),
          intensity: intensity.get(date.getDate()) ?? 0,
          selected: !filtering && isSameDay(date, selectedDay),
          isToday: isSameDay(date, today),
          accessibilityLabel: `${dayShort.format(date)}: ${
            spent ? `${spent.format()} gastados` : 'sin gastos'
          }`,
        };
      }),
    );

    const income = (totals.data ?? []).reduce((sum, t) => sum.plus(t.income), Money.zero(currency));
    const expenses = (totals.data ?? []).reduce(
      (sum, t) => sum.plus(t.expenses),
      Money.zero(currency),
    );

    const items: Transaction[] = list.data?.pages.flatMap((page) => page.items) ?? [];
    // A failed refresh keeps the pages already loaded (offline).
    const listStatus: HistoryListStatus =
      list.isError && list.data === undefined ? 'error' : list.isPending ? 'loading' : 'ready';

    return {
      status: 'ready',
      monthLabel: capitalize(monthName.format(new Date(month.year, month.month - 1, 1))),
      canGoNext: !isFutureMonth(shiftMonth(month, 1), today),
      weekdays: WEEKDAYS,
      weeks,
      monthIncome: income.format(),
      monthExpenses: expenses.format(),
      searchText,
      typeFilter,
      sharedOnly,
      filtering,
      heading: filtering ? 'Resultados' : capitalize(dayHeading.format(selectedDay)),
      rows: items.map((tx) => ({
        id: tx.id,
        title: tx.description || categoryName.get(tx.categoryId) || 'Sin nota',
        subtitle: [
          categoryName.get(tx.categoryId),
          filtering ? dayMonth.format(tx.occurredAt) : null,
          tx.shared ? 'compartido' : null,
        ]
          .filter(Boolean)
          .join(' · '),
        amount: `${tx.type === 'income' ? '+' : '-'}${tx.amount.format()}`,
        tone: tx.type === 'income' ? 'income' : 'expense',
      })),
      listStatus,
      hasMore: list.hasNextPage,
      loadingMore: list.isFetchingNextPage,
    };
  }, [
    household,
    month,
    spentByDay,
    intensity,
    filtering,
    selectedDay,
    today,
    totals.data,
    list.data,
    list.isError,
    list.isPending,
    list.hasNextPage,
    list.isFetchingNextPage,
    categoryName,
    searchText,
    typeFilter,
    sharedOnly,
  ]);

  const goToMonth = useCallback(
    (next: YearMonth) => {
      setMonth(next);
      // Keep a selected day inside the month that is on screen: today if it is the current one.
      setSelectedDay(
        isSameMonth(next, monthOf(today)) ? today : new Date(next.year, next.month - 1, 1),
      );
    },
    [today],
  );

  const previousMonth = useCallback(() => goToMonth(shiftMonth(month, -1)), [goToMonth, month]);
  const nextMonth = useCallback(() => {
    const next = shiftMonth(month, 1);
    if (!isFutureMonth(next, today)) goToMonth(next);
  }, [goToMonth, month, today]);

  /** Tapping a day also leaves any search: the person wants to see THAT day. */
  const selectDay = useCallback((date: Date) => {
    setSelectedDay(startOfDay(date));
    setSearchText('');
    setTypeFilter('all');
    setSharedOnly(false);
  }, []);

  const clearFilters = useCallback(() => {
    setSearchText('');
    setTypeFilter('all');
    setSharedOnly(false);
  }, []);

  const loadMore = useCallback(() => {
    if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
  }, [list]);

  const refresh = useCallback(
    () => Promise.all([totals.refetch(), list.refetch()]),
    [totals, list],
  );

  return {
    state,
    previousMonth,
    nextMonth,
    selectDay,
    setSearchText,
    setTypeFilter,
    setSharedOnly,
    clearFilters,
    loadMore,
    refresh,
  };
}
