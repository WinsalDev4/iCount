import type { DailyTotal } from './Transaction';

/** 0 = no spending that day; 1 (a little) … 4 (a lot) relative to the rest of the month. */
export type Intensity = 0 | 1 | 2 | 3 | 4;

/**
 * Intensity of one day against the days of the month that have spending (quartiles).
 *
 * The level is the quartile of the day's PERCENTILE RANK, where ties share the middle of their
 * group: one single day, or days that all spent the same, land in the middle (3) instead of
 * pretending to be the lowest or the highest. Money is compared as integer cents.
 */
export function intensityOf(amountMinor: number, monthAmountsMinor: readonly number[]): Intensity {
  if (amountMinor <= 0) return 0;
  const values = monthAmountsMinor.filter((v) => v > 0);
  if (values.length === 0) return 0;

  const below = values.filter((v) => v < amountMinor).length;
  const equal = values.filter((v) => v === amountMinor).length;
  const percentile = (below + equal / 2) / values.length; // 0 < percentile < 1
  return (1 + Math.min(3, Math.floor(percentile * 4))) as Intensity;
}

/** Intensity per day of the month (1-based day number), from the daily totals of expenses. */
export function intensityByDay(totals: readonly DailyTotal[]): ReadonlyMap<number, Intensity> {
  const amounts = totals.map((t) => t.expenses.amountMinor);
  return new Map(
    totals.map((t) => [t.date.getDate(), intensityOf(t.expenses.amountMinor, amounts)]),
  );
}
