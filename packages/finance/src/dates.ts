/**
 * Calendar dates as `YYYY-MM-DD` strings (no time, no zone), like the contracts.
 * Instalments fall "on a day", so zone-free arithmetic avoids off-by-one errors.
 */
export type LocalDate = string;

const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface DateParts {
  readonly year: number;
  /** 1–12 */
  readonly month: number;
  readonly day: number;
}

export function parseLocalDate(date: LocalDate): DateParts {
  const match = LOCAL_DATE.exec(date);
  if (!match) throw new RangeError(`Expected YYYY-MM-DD, got ${date}`);
  const parts = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  if (
    parts.month < 1 ||
    parts.month > 12 ||
    parts.day < 1 ||
    parts.day > daysInMonth(parts.year, parts.month)
  ) {
    throw new RangeError(`Invalid date ${date}`);
  }
  return parts;
}

export function formatLocalDate({ year, month, day }: DateParts): LocalDate {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function daysInMonth(year: number, month: number): number {
  // Day 0 of the next month = last day of this month (UTC: no DST surprises).
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Adds months keeping the *anchor* day: an instalment on the 31st falls on the
 * 28th/29th in February and back on the 31st in March.
 */
export function addMonths(date: LocalDate, months: number, anchorDay?: number): LocalDate {
  const { year, month, day } = parseLocalDate(date);
  const index = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(index / 12);
  const targetMonth = (index % 12) + 1;
  const wanted = anchorDay ?? day;
  return formatLocalDate({
    year: targetYear,
    month: targetMonth,
    day: Math.min(wanted, daysInMonth(targetYear, targetMonth)),
  });
}

/** Adds (or subtracts) calendar days; UTC arithmetic, so DST never shifts the result. */
export function addDays(date: LocalDate, days: number): LocalDate {
  const { year, month, day } = parseLocalDate(date);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return formatLocalDate({
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  });
}

/** Lexicographic order of YYYY-MM-DD is chronological order. */
export function compareLocalDates(a: LocalDate, b: LocalDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
