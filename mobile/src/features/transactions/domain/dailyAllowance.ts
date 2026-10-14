import { Money } from '@/core/domain/Money';

import { daysRemainingIncludingToday } from './calendar';

export type AllowanceStatus =
  /** There is money for today and you are within it. */
  | 'on-track'
  /** The month still has money, but today's spending already went past today's share. */
  | 'over-today'
  /** There is nothing left to share: income minus expenses of the month is zero or negative. */
  | 'month-in-deficit';

export interface DailyAllowance {
  /** What each remaining day (today included) can spend: the money left, evenly shared. */
  readonly dailyAllowance: Money;
  readonly spentToday: Money;
  /** Today's share minus today's spending; negative when you went past it. */
  readonly leftToday: Money;
  /** Days left in the month counting today. */
  readonly daysRemaining: number;
  /** Income minus expenses of the month so far (what is left to spend). */
  readonly monthBalance: Money;
  readonly status: AllowanceStatus;
}

/**
 * "Gasto diario disponible" (screen 04-C): how much can I spend today without running out
 * before the month ends?
 *
 *   money left at the start of today = month balance + what was spent today
 *   daily allowance                  = that money ÷ days left, rounded DOWN to the cent
 *   left today                       = daily allowance − spent today
 *
 * Rounding down never promises a cent that is not there. With a zero or negative balance the
 * allowance is 0 (there is nothing to share), not a negative number.
 */
export function computeDailyAllowance(input: {
  monthBalance: Money;
  spentToday: Money;
  today: Date;
}): DailyAllowance {
  const { monthBalance, spentToday, today } = input;
  const currency = monthBalance.currency;
  const daysRemaining = daysRemainingIncludingToday(today);

  const moneyAtStartOfToday = monthBalance.plus(spentToday);
  const dailyMinor =
    moneyAtStartOfToday.amountMinor > 0
      ? Math.floor(moneyAtStartOfToday.amountMinor / daysRemaining)
      : 0;
  const dailyAllowance = Money.ofMinor(dailyMinor, currency);
  const leftToday = dailyAllowance.minus(spentToday);

  const status: AllowanceStatus =
    moneyAtStartOfToday.amountMinor <= 0
      ? 'month-in-deficit'
      : leftToday.isNegative()
        ? 'over-today'
        : 'on-track';

  return { dailyAllowance, spentToday, leftToday, daysRemaining, monthBalance, status };
}
