import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useDependencies } from '@/core/di/DependenciesProvider';
import { Money } from '@/core/domain/Money';
import { queryKeys } from '@/core/query/queryKeys';
import { useActiveHousehold } from '@/features/household/presentation/households';

import { startOfDay } from '../../domain/calendar';
import type { AllowanceStatus } from '../../domain/dailyAllowance';
import type { Transaction } from '../../domain/Transaction';

export interface WeekBar {
  readonly key: string;
  /** "L", "M", "X"… */
  readonly label: string;
  /** 0..1 against the busiest day of the week. */
  readonly ratio: number;
  readonly highlighted: boolean;
  /** "lunes: 12,00 €" */
  readonly accessibilityLabel: string;
}

export interface RecentRow {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  /** "-12,50 €" / "+1.925,00 €" */
  readonly amount: string;
  readonly tone: 'income' | 'expense';
}

export type HomeUiState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message: string }
  | {
      readonly status: 'success';
      readonly householdName: string;
      readonly memberNames: readonly string[];
      /** The big number: what is left to spend today ("42,10 €", or "-5,00 €" when over). */
      readonly leftToday: string;
      readonly allowanceStatus: AllowanceStatus;
      /** "Hoy puedes gastar 60,00 € · quedan 15 días" */
      readonly caption: string;
      readonly monthBalance: string;
      readonly weekBars: readonly WeekBar[];
      readonly weekTotal: string;
      readonly recent: readonly RecentRow[];
      /** Budgets arrive in phase 4 (B-4.1); the slot exists so Inicio does not need reshaping. */
      readonly budgets: null;
    };

const weekdayLong = new Intl.DateTimeFormat('es-ES', { weekday: 'long' });
const dayMonth = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });
const LETTERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const;

function labelOf(member: { displayName: string | null; email: string }): string {
  return member.displayName ?? member.email.split('@')[0] ?? member.email;
}

function signed(tx: Transaction): string {
  return `${tx.type === 'income' ? '+' : '-'}${tx.amount.format()}`;
}

/**
 * ViewModel of Inicio (screen 04-C "gasto diario"): how much can be spent today, the week in
 * bars and the latest movements. Three small queries instead of one big one, so each refreshes
 * on its own; they all live under `transactions.all(household)` and a new movement refreshes them.
 */
export function useHomeViewModel() {
  const { getDailyAllowance, getWeeklySpending, getRecentTransactions } =
    useDependencies().transactions;
  const household = useActiveHousehold();
  const householdId = household?.id ?? '';
  const today = useMemo(() => startOfDay(new Date()), []);
  const dayKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
  const enabled = household !== undefined;

  const allowance = useQuery({
    queryKey: [...queryKeys.transactions.all(householdId), 'allowance', dayKey],
    queryFn: () => getDailyAllowance.execute(householdId, today),
    enabled,
  });
  const week = useQuery({
    queryKey: [...queryKeys.transactions.all(householdId), 'week', dayKey],
    queryFn: () => getWeeklySpending.execute(householdId, today),
    enabled,
  });
  const recent = useQuery({
    // Under "lists": a movement added optimistically is prepended to this page right away.
    queryKey: queryKeys.transactions.list(householdId, { recent: true }),
    queryFn: async () => ({
      items: await getRecentTransactions.execute(householdId, 4),
      nextCursor: null,
    }),
    enabled,
  });

  const state = useMemo<HomeUiState>(() => {
    if (!household) return { status: 'loading' };
    if (allowance.error ?? week.error ?? recent.error) {
      return { status: 'error', message: 'No hemos podido cargar tu resumen. Inténtalo de nuevo.' };
    }
    if (!allowance.data || !week.data || !recent.data) return { status: 'loading' };

    const a = allowance.data;
    const currency = a.monthBalance.currency;
    const maxSpent = Math.max(0, ...week.data.map((d) => d.spent.amountMinor));
    const weekTotalMinor = week.data.reduce((sum, d) => sum + d.spent.amountMinor, 0);

    const caption =
      a.status === 'month-in-deficit'
        ? 'Este mes ya has gastado más de lo que ha entrado.'
        : `Hoy puedes gastar ${a.dailyAllowance.format()} · ${
            a.daysRemaining === 1 ? 'último día del mes' : `quedan ${a.daysRemaining} días`
          }`;

    return {
      status: 'success',
      householdName: household.name,
      memberNames: household.members.map(labelOf),
      leftToday: a.leftToday.format(),
      allowanceStatus: a.status,
      caption,
      monthBalance: a.monthBalance.format(),
      weekBars: week.data.map((d, i) => ({
        key: d.date.toISOString(),
        label: LETTERS[i] ?? '',
        ratio: maxSpent === 0 ? 0 : d.spent.amountMinor / maxSpent,
        highlighted: d.isToday,
        accessibilityLabel: `${weekdayLong.format(d.date)}: ${d.spent.format()}`,
      })),
      weekTotal: Money.ofMinor(weekTotalMinor, currency).format(),
      recent: recent.data.items.map((tx) => ({
        id: tx.id,
        title: tx.description || 'Sin nota',
        subtitle: dayMonth.format(tx.occurredAt),
        amount: signed(tx),
        tone: tx.type === 'income' ? 'income' : 'expense',
      })),
      budgets: null,
    };
  }, [
    household,
    allowance.data,
    allowance.error,
    week.data,
    week.error,
    recent.data,
    recent.error,
  ]);

  const refresh = () => Promise.all([allowance.refetch(), week.refetch(), recent.refetch()]);
  return { state, refresh };
}
