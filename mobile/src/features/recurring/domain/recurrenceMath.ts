import { nextOccurrence, occurrencesBetween, type RecurrenceRule } from '@icount/finance';

import { fromLocalDate, toLocalDate } from '@/features/transactions/data/api/transactionMapper';

import type { RecurringPayment } from './RecurringPayment';

type Series = Pick<RecurringPayment, 'rule' | 'startDate' | 'endDate'>;

const asLocal = (date: Date | null) => (date === null ? null : toLocalDate(date));

/** Due dates of the series in `[from, to]` (both inclusive), earliest first. */
export function dueDatesBetween(series: Series, from: Date, to: Date): Date[] {
  return occurrencesBetween(
    series.rule,
    toLocalDate(series.startDate),
    asLocal(series.endDate),
    toLocalDate(from),
    toLocalDate(to),
  ).map(fromLocalDate);
}

/** First due date on or after `today` (today counts), or `null` when the series has ended. */
export function nextDueDate(series: Series, today: Date): Date | null {
  const next = nextOccurrence(
    series.rule,
    toLocalDate(series.startDate),
    asLocal(series.endDate),
    toLocalDate(today),
  );
  return next === null ? null : fromLocalDate(next);
}

const MONTH_NAMES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const;

/** "cada mes, el día 5" · "cada 3 meses, el último día" · "cada año, el 15 de junio". */
export function describeRule(rule: RecurrenceRule): string {
  const day = rule.dayOfMonth === 31 ? 'el último día' : `el día ${rule.dayOfMonth}`;
  if (rule.unit === 'year') {
    const every = rule.interval === 1 ? 'cada año' : `cada ${rule.interval} años`;
    const month = MONTH_NAMES[(rule.monthOfYear ?? 1) - 1];
    const when = rule.dayOfMonth === 31 ? `el 31 de ${month}` : `el ${rule.dayOfMonth} de ${month}`;
    return `${every}, ${when}`;
  }
  const every = rule.interval === 1 ? 'cada mes' : `cada ${rule.interval} meses`;
  return `${every}, ${day}`;
}

/** The frequencies the form offers; the rule's anchor (day, month) comes from the first due date. */
export type Frequency = 'monthly' | 'quarterly' | 'biannual' | 'yearly';

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  monthly: 'Cada mes',
  quarterly: 'Cada 3 meses',
  biannual: 'Cada 6 meses',
  yearly: 'Cada año',
};

export function ruleFor(frequency: Frequency, anchor: Date): RecurrenceRule {
  const dayOfMonth = anchor.getDate();
  switch (frequency) {
    case 'monthly':
      return { unit: 'month', interval: 1, dayOfMonth };
    case 'quarterly':
      return { unit: 'month', interval: 3, dayOfMonth };
    case 'biannual':
      return { unit: 'month', interval: 6, dayOfMonth };
    case 'yearly':
      return { unit: 'year', interval: 1, dayOfMonth, monthOfYear: anchor.getMonth() + 1 };
  }
}

/** The form frequency of a stored rule, or `null` when it is a custom one (e.g. every 2 months). */
export function frequencyOf(rule: RecurrenceRule): Frequency | null {
  if (rule.unit === 'year') return rule.interval === 1 ? 'yearly' : null;
  if (rule.interval === 1) return 'monthly';
  if (rule.interval === 3) return 'quarterly';
  if (rule.interval === 6) return 'biannual';
  return null;
}

/**
 * Changes only the periodicity of a stored rule, keeping its day (a 31 stays "the last day").
 * Yearly rules need a month: the rule's own, else `fallbackMonth` (1–12).
 */
export function ruleWithFrequency(
  rule: RecurrenceRule,
  frequency: Frequency,
  fallbackMonth: number,
): RecurrenceRule {
  const { dayOfMonth } = rule;
  switch (frequency) {
    case 'monthly':
      return { unit: 'month', interval: 1, dayOfMonth };
    case 'quarterly':
      return { unit: 'month', interval: 3, dayOfMonth };
    case 'biannual':
      return { unit: 'month', interval: 6, dayOfMonth };
    case 'yearly':
      return {
        unit: 'year',
        interval: 1,
        dayOfMonth,
        monthOfYear: rule.monthOfYear ?? fallbackMonth,
      };
  }
}
