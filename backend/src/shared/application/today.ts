import type { Clock } from './clock.js';

/** Today as a calendar day (`YYYY-MM-DD`) in the households' time zone. */
export type Today = () => string;

/** Injection token for `Today`. */
export const TODAY = Symbol('TODAY');

/** Spain for now; per-household time zones would come from the household itself. */
export function todayIn(clock: Clock, timeZone = 'Europe/Madrid'): Today {
  // en-CA formats dates as YYYY-MM-DD.
  return () => new Intl.DateTimeFormat('en-CA', { timeZone }).format(clock.now());
}

/** The instant a calendar day starts in a time zone (DST-aware), e.g. for daily quotas. */
export function startOfDayIn(day: string, timeZone = 'Europe/Madrid'): Date {
  const utcMidnight = new Date(`${day}T00:00:00Z`);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(utcMidnight)
      .map((part) => [part.type, part.value]),
  );
  // What the zone's clock reads at UTC midnight tells its offset that day.
  const zoneReading = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return new Date(utcMidnight.getTime() - (zoneReading - utcMidnight.getTime()));
}
