/** Pure calendar helpers (local time). No libraries: a few lines of Date arithmetic. */

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  // new Date(y, m, d + n) lets the engine carry month and year (and daylight-saving changes).
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Number of days in the month of `date` (28–31, February leap years included). */
export function daysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/** Days left in the month counting today: the 31st of a 31-day month is 1. */
export function daysRemainingIncludingToday(today: Date): number {
  return daysInMonth(today) - today.getDate() + 1;
}

/**
 * The seven days of the week that contains `date`, Monday first (the Spanish week).
 * It can span two months or two years.
 */
export function weekDays(date: Date): Date[] {
  const day = startOfDay(date);
  const sinceMonday = (day.getDay() + 6) % 7; // Sunday(0) → 6, Monday(1) → 0
  const monday = addDays(day, -sinceMonday);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}
