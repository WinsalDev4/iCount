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
