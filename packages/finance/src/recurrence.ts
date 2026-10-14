import {
  compareLocalDates,
  daysInMonth,
  formatLocalDate,
  type LocalDate,
  parseLocalDate,
} from './dates.ts';

/** Mirrors `recurrenceRuleSchema` of the contracts. */
export interface RecurrenceRule {
  readonly unit: 'month' | 'year';
  /** Every `interval` months / years. */
  readonly interval: number;
  /** 1–31; in shorter months it falls on the last day (31 → 30, 28 or 29). */
  readonly dayOfMonth: number;
  /** 1–12, only for yearly rules. */
  readonly monthOfYear?: number;
}

const MAX_OCCURRENCES = 10_000;

/**
 * The n-th date (0-based) of the series anchored at the rule, counting from the
 * month (or year) of `startDate`. It may fall before `startDate`; see `occurrencesBetween`.
 */
function seriesDate(
  rule: RecurrenceRule,
  start: { year: number; month: number },
  n: number,
): LocalDate {
  const monthIndex =
    rule.unit === 'month'
      ? start.year * 12 + (start.month - 1) + n * rule.interval
      : (start.year + n * rule.interval) * 12 + ((rule.monthOfYear ?? 1) - 1);
  const year = Math.floor(monthIndex / 12);
  const month = (monthIndex % 12) + 1;
  return formatLocalDate({ year, month, day: Math.min(rule.dayOfMonth, daysInMonth(year, month)) });
}

function assertRule(rule: RecurrenceRule): void {
  if (!Number.isInteger(rule.interval) || rule.interval < 1) {
    throw new RangeError(`interval must be a positive integer, got ${rule.interval}`);
  }
  if (!Number.isInteger(rule.dayOfMonth) || rule.dayOfMonth < 1 || rule.dayOfMonth > 31) {
    throw new RangeError(`dayOfMonth must be 1–31, got ${rule.dayOfMonth}`);
  }
  if (
    rule.unit === 'year' &&
    (rule.monthOfYear === undefined || rule.monthOfYear < 1 || rule.monthOfYear > 12)
  ) {
    throw new RangeError('Yearly rules need monthOfYear 1–12');
  }
}

/**
 * Due dates in `[from, to]` (inclusive) of a series that starts on `startDate`
 * and, if given, ends on `endDate`. Earliest first.
 *
 * Examples: rule `{ month, 1, day 31 }` from 2026-01-15 → 01-31, 02-28, 03-31…
 *           rule `{ year, 1, day 15, monthOfYear 6 }` → every 15 June.
 */
export function occurrencesBetween(
  rule: RecurrenceRule,
  startDate: LocalDate,
  endDate: LocalDate | null,
  from: LocalDate,
  to: LocalDate,
): LocalDate[] {
  assertRule(rule);
  const start = parseLocalDate(startDate);
  const dates: LocalDate[] = [];

  for (let n = 0; n < MAX_OCCURRENCES; n++) {
    const date = seriesDate(rule, start, n);
    if (compareLocalDates(date, to) > 0) break;
    if (endDate !== null && compareLocalDates(date, endDate) > 0) break;
    if (compareLocalDates(date, startDate) >= 0 && compareLocalDates(date, from) >= 0) {
      dates.push(date);
    }
  }
  return dates;
}

/** First due date on or after `onOrAfter` (null when the series has ended). */
export function nextOccurrence(
  rule: RecurrenceRule,
  startDate: LocalDate,
  endDate: LocalDate | null,
  onOrAfter: LocalDate,
): LocalDate | null {
  assertRule(rule);
  const start = parseLocalDate(startDate);
  for (let n = 0; n < MAX_OCCURRENCES; n++) {
    const date = seriesDate(rule, start, n);
    if (endDate !== null && compareLocalDates(date, endDate) > 0) return null;
    if (compareLocalDates(date, startDate) >= 0 && compareLocalDates(date, onOrAfter) >= 0) {
      return date;
    }
  }
  return null;
}
