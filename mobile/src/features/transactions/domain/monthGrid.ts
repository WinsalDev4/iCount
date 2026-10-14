import type { YearMonth } from '@/core/domain/YearMonth';

import { addDays, daysInMonth } from './calendar';

/** One cell of the calendar: a real day, or `null` padding before the 1st / after the last. */
export type GridCell = Date | null;

/** Calendar of a month as rows of seven cells, Monday first (the Spanish week). */
export function buildMonthGrid({ year, month }: YearMonth): GridCell[][] {
  const first = new Date(year, month - 1, 1);
  const leading = (first.getDay() + 6) % 7; // Monday → 0 … Sunday → 6
  const total = daysInMonth(first);

  const cells: GridCell[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: total }, (_, i) => addDays(first, i)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return Array.from({ length: cells.length / 7 }, (_, row) => cells.slice(row * 7, row * 7 + 7));
}

/** The previous (-1) or next (+1) month, carrying the year. */
export function shiftMonth({ year, month }: YearMonth, delta: number): YearMonth {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function monthOf(date: Date): YearMonth {
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

export function isSameMonth(a: YearMonth, b: YearMonth): boolean {
  return a.year === b.year && a.month === b.month;
}

/** True when `month` is after the month of `today`: the history has nothing to show there. */
export function isFutureMonth(month: YearMonth, today: Date): boolean {
  const current = monthOf(today);
  return month.year * 12 + month.month > current.year * 12 + current.month;
}
