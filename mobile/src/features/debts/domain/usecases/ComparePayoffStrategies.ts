import { Money } from '@/core/domain/Money';

import type { Debt, PayoffPlan } from '../Debt';
import { computePayoffPlan } from '../payoffPlans';

export interface StrategyComparison {
  readonly avalanche: PayoffPlan;
  readonly snowball: PayoffPlan;
  /** Interest the avalanche saves over the snowball (never negative: avalanche minimises it). */
  readonly avalancheSavesInterest: Money;
  /** Months the avalanche finishes before the snowball (0 when equal). */
  readonly avalancheSavesMonths: number;
  /** The debt the snowball would clear first (a quick win), by id. */
  readonly snowballFirstWin: string | null;
}

/**
 * Avalanche (highest rate first) vs snowball (smallest balance first) for the household's debts,
 * with the same monthly budget. Computed on the device with @icount/finance; returns `null` when
 * there is nothing owed.
 */
export class ComparePayoffStrategies {
  execute(debts: readonly Debt[], extraMonthly: Money, today: Date): StrategyComparison | null {
    const avalanche = computePayoffPlan(debts, 'avalanche', extraMonthly, today);
    const snowball = computePayoffPlan(debts, 'snowball', extraMonthly, today);
    if (!avalanche || !snowball) return null;

    const currency = avalanche.totalInterest.currency;
    return {
      avalanche,
      snowball,
      avalancheSavesInterest: Money.ofMinor(
        Math.max(0, snowball.totalInterest.amountMinor - avalanche.totalInterest.amountMinor),
        currency,
      ),
      avalancheSavesMonths: Math.max(
        0,
        monthsBetween(snowball.debtFreeDate, avalanche.debtFreeDate),
      ),
      snowballFirstWin: snowball.debts.find((d) => d.order === 1)?.debtId ?? null,
    };
  }
}

function monthsBetween(later: Date, earlier: Date): number {
  return (
    (later.getFullYear() - earlier.getFullYear()) * 12 + (later.getMonth() - earlier.getMonth())
  );
}
