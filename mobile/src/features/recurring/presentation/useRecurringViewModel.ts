import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { useDependencies } from '@/core/di/DependenciesProvider';
import { Money, type CurrencyCode } from '@/core/domain/Money';
import type { YearMonth } from '@/core/domain/YearMonth';
import { queryKeys } from '@/core/query/queryKeys';
import { useActiveHousehold } from '@/features/household/presentation/households';
import type { DayCell } from '@/features/transactions/presentation/history/useHistoryViewModel';
import { addDays, isSameDay, startOfDay } from '@/features/transactions/domain/calendar';
import { buildMonthGrid, monthOf, shiftMonth } from '@/features/transactions/domain/monthGrid';

import { remindersPreferenceStore, useRemindersPreference } from '../data/remindersPreferenceStore';
import { describeRule } from '../domain/recurrenceMath';
import type { RecurringPayment, UpcomingDue } from '../domain/RecurringPayment';
import { formatShortDate, KIND_LABELS, relativeDays } from './recurringLabels';

export type RecurringTab = 'list' | 'calendar';

/** How far the "Próximos" list looks ahead. */
const LIST_DAYS = 30;
const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const;
const monthName = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' });
const dayHeading = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

export interface DueRow {
  readonly key: string;
  readonly paymentId: string;
  readonly name: string;
  /** "jue 15 oct · mañana" */
  readonly when: string;
  /** "-12,99 €" / "+1.950,00 €" */
  readonly amount: string;
  readonly tone: 'income' | 'expense';
}

export interface PaymentRow {
  readonly id: string;
  readonly name: string;
  readonly kindLabel: string;
  /** "cada mes, el día 5" */
  readonly rule: string;
  readonly amount: string;
  readonly tone: 'income' | 'expense';
  /** "Próximo: jue 15 oct" / "Terminado". */
  readonly next: string;
}

export interface RemindersState {
  readonly enabled: boolean;
  readonly busy: boolean;
  /** Why they could not be switched on, or a confirmation; null when there is nothing to say. */
  readonly notice: string | null;
}

export type RecurringUiState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message: string }
  | {
      readonly status: 'ready';
      readonly tab: RecurringTab;
      readonly reminders: RemindersState;
      /** Expenses due in the next 30 days, e.g. "128,99 €"; null when there are none. */
      readonly next30DaysExpenses: string | null;
      readonly upcoming: readonly DueRow[];
      readonly payments: readonly PaymentRow[];
      /** "octubre de 2026" */
      readonly monthLabel: string;
      readonly weekdays: readonly string[];
      readonly weeks: readonly (readonly (DayCell | null)[])[];
      /** "Pagos del mes: 850,00 €" */
      readonly monthSummary: string;
      /** "jueves, 15 de octubre" */
      readonly heading: string;
      readonly dayRows: readonly DueRow[];
    };

const toRow = (due: UpcomingDue, today: Date): DueRow => ({
  key: `${due.recurringPaymentId}-${due.dueDate.getTime()}`,
  paymentId: due.recurringPaymentId,
  name: due.name,
  when: `${formatShortDate(due.dueDate)} · ${relativeDays(due.dueDate, today)}`,
  amount: `${due.type === 'income' ? '+' : '-'}${due.amount.format()}`,
  tone: due.type,
});

function toPaymentRow(payment: RecurringPayment): PaymentRow {
  return {
    id: payment.id,
    name: payment.name,
    kindLabel: KIND_LABELS[payment.kind],
    rule: describeRule(payment.rule),
    amount: `${payment.type === 'income' ? '+' : '-'}${payment.amount.format()}`,
    tone: payment.type,
    next: payment.nextDueDate ? `Próximo: ${formatShortDate(payment.nextDueDate)}` : 'Terminado',
  };
}

/** Sum of the expenses in `dues`. */
function expensesTotal(dues: readonly UpcomingDue[], currency: CurrencyCode): Money {
  return dues
    .filter((due) => due.type === 'expense')
    .reduce((sum, due) => sum.plus(due.amount), Money.zero(currency));
}

/**
 * ViewModel of Pagos recurrentes (screen 08-D): what falls due soon (list), the month on a calendar,
 * the payments themselves, and the switch for local reminders. The OS permission is asked here, in
 * context, when the person turns the reminders on, never when the app opens.
 */
export function useRecurringViewModel() {
  const { listRecurringPayments, listUpcomingDues, syncReminders, remindersScheduler } =
    useDependencies().recurring;
  const household = useActiveHousehold();
  const householdId = household?.id ?? '';
  const currency = household?.currency ?? 'EUR';
  const today = useMemo(() => startOfDay(new Date()), []);

  const [tab, setTab] = useState<RecurringTab>('list');
  const [month, setMonth] = useState<YearMonth>(() => monthOf(today));
  const [selectedDay, setSelectedDay] = useState<Date>(today);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const remindersOn = useRemindersPreference((s) => s.enabled);
  const remindersHydrated = useRemindersPreference((s) => s.hydrated);

  const paymentsQuery = useQuery({
    queryKey: queryKeys.recurring.all(householdId),
    queryFn: () => listRecurringPayments.execute(householdId),
    enabled: household !== undefined,
  });

  const listTo = useMemo(() => addDays(today, LIST_DAYS), [today]);
  const upcomingQuery = useQuery({
    queryKey: [...queryKeys.recurring.all(householdId), 'upcoming', 'list'] as const,
    queryFn: () => listUpcomingDues.execute(householdId, today, listTo),
    enabled: household !== undefined,
  });

  const monthFrom = useMemo(() => new Date(month.year, month.month - 1, 1), [month]);
  const monthTo = useMemo(() => new Date(month.year, month.month, 0), [month]);
  const monthQuery = useQuery({
    queryKey: [
      ...queryKeys.recurring.all(householdId),
      'upcoming',
      'month',
      month.year,
      month.month,
    ] as const,
    queryFn: () => listUpcomingDues.execute(householdId, monthFrom, monthTo),
    enabled: household !== undefined && tab === 'calendar',
  });

  // Keep the 45-day window of reminders fresh: when the screen opens and after every change.
  const paymentsUpdatedAt = paymentsQuery.dataUpdatedAt;
  useEffect(() => {
    if (!remindersOn || !remindersHydrated || householdId === '') return;
    let cancelled = false;
    void (async () => {
      try {
        if ((await remindersScheduler.permission()) !== 'granted') {
          // The person revoked it in Settings: reflect it instead of pretending to remind.
          if (!cancelled) {
            remindersPreferenceStore.getState().setEnabled(false);
            setNotice('Los avisos están desactivados en los Ajustes del teléfono.');
          }
          return;
        }
        await syncReminders.execute(householdId);
      } catch {
        // Reminders are a convenience: a failed sync must never break the screen.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    remindersOn,
    remindersHydrated,
    householdId,
    paymentsUpdatedAt,
    remindersScheduler,
    syncReminders,
  ]);

  const state = useMemo<RecurringUiState>(() => {
    if (!household) return { status: 'loading' };
    if (paymentsQuery.isError || upcomingQuery.isError) {
      return { status: 'error', message: 'No hemos podido cargar tus pagos recurrentes.' };
    }
    if (!paymentsQuery.data || !upcomingQuery.data) return { status: 'loading' };

    const monthDues = monthQuery.data ?? [];
    const byDay = new Map<number, UpcomingDue[]>();
    for (const due of monthDues) {
      byDay.set(due.dueDate.getDate(), [...(byDay.get(due.dueDate.getDate()) ?? []), due]);
    }

    const weeks = buildMonthGrid(month).map((week) =>
      week.map((date): DayCell | null => {
        if (date === null) return null;
        const dues = byDay.get(date.getDate()) ?? [];
        const selected = isSameDay(date, selectedDay);
        const weekday = new Intl.DateTimeFormat('es-ES', { weekday: 'long' }).format(date);
        return {
          key: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
          date,
          day: date.getDate(),
          intensity: dues.length === 0 ? 0 : dues.length === 1 ? 2 : dues.length === 2 ? 3 : 4,
          selected,
          isToday: isSameDay(date, today),
          accessibilityLabel:
            dues.length === 0
              ? `${weekday} ${date.getDate()}: sin vencimientos`
              : `${weekday} ${date.getDate()}: ${dues.length} ${dues.length === 1 ? 'vencimiento' : 'vencimientos'}`,
        };
      }),
    );

    const monthExpenses = expensesTotal(monthDues, currency);
    const next30 = expensesTotal(upcomingQuery.data, currency);
    return {
      status: 'ready',
      tab,
      reminders: { enabled: remindersOn, busy, notice },
      next30DaysExpenses: next30.amountMinor > 0 ? next30.format() : null,
      upcoming: upcomingQuery.data.map((due) => toRow(due, today)),
      payments: paymentsQuery.data.map(toPaymentRow),
      monthLabel: monthName.format(monthFrom),
      weekdays: WEEKDAYS,
      weeks,
      monthSummary:
        monthExpenses.amountMinor > 0
          ? `Pagos del mes: ${monthExpenses.format()}`
          : 'Este mes no vence ningún pago',
      heading: dayHeading.format(selectedDay),
      dayRows: (byDay.get(selectedDay.getDate()) ?? [])
        .filter((due) => isSameDay(due.dueDate, selectedDay))
        .map((due) => toRow(due, today)),
    };
  }, [
    household,
    paymentsQuery.isError,
    paymentsQuery.data,
    upcomingQuery.isError,
    upcomingQuery.data,
    monthQuery.data,
    month,
    monthFrom,
    selectedDay,
    tab,
    today,
    currency,
    remindersOn,
    busy,
    notice,
  ]);

  function changeMonth(delta: number) {
    const next = shiftMonth(month, delta);
    setMonth(next);
    // Keep a sensible selection: today when going to the current month, else the 1st.
    setSelectedDay(
      next.year === today.getFullYear() && next.month === today.getMonth() + 1
        ? today
        : new Date(next.year, next.month - 1, 1),
    );
  }

  /** Turns the local reminders on (asking the OS in context) or off. */
  async function setReminders(enable: boolean): Promise<void> {
    setNotice(null);
    setBusy(true);
    try {
      if (!enable) {
        remindersPreferenceStore.getState().setEnabled(false);
        await remindersScheduler.cancelAll();
        return;
      }
      let permission = await remindersScheduler.permission();
      if (permission === 'undetermined') permission = await remindersScheduler.requestPermission();
      if (permission !== 'granted') {
        setNotice(
          'Para avisarte tienes que permitir las notificaciones de iCount en los Ajustes del teléfono.',
        );
        return;
      }
      remindersPreferenceStore.getState().setEnabled(true);
      await syncReminders.execute(householdId);
      setNotice('Listo: te avisaremos a las 9:00 del día antes de cada pago.');
    } catch {
      setNotice('No hemos podido programar los avisos. Inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  return {
    state,
    refresh: () => Promise.all([paymentsQuery.refetch(), upcomingQuery.refetch()]),
    selectTab: setTab,
    selectDay: setSelectedDay,
    previousMonth: () => changeMonth(-1),
    nextMonth: () => changeMonth(1),
    setReminders,
  };
}
