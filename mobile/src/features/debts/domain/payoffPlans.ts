import {
  PaymentTooLowError,
  payoffPlan,
  type PayoffPlan as EnginePlan,
  type PayoffStrategy,
} from '@icount/finance';

import { Money } from '@/core/domain/Money';
import { fromLocalDate, toLocalDate } from '@/features/transactions/data/api/transactionMapper';

import type { Debt, PayoffPlan } from './Debt';
import { DebtError } from './DebtError';

/**
 * The payoff plan of a strategy for the debts that are still alive, computed with the shared
 * engine (@icount/finance). Same monthly budget for every strategy: every instalment + the extra.
 * `null` when nothing is owed. A debt whose instalment does not cover its interest is "invalid".
 */
export function computePayoffPlan(
  debts: readonly Debt[],
  strategy: PayoffStrategy,
  extraMonthly: Money,
  today: Date,
): PayoffPlan | null {
  const alive = debts.filter((d) => d.outstanding.amountMinor > 0);
  if (alive.length === 0) return null;
  if (extraMonthly.amountMinor < 0) throw new DebtError('invalid');

  const currency = alive[0]?.outstanding.currency ?? extraMonthly.currency;
  try {
    const plan = payoffPlan(
      alive.map((d) => ({
        id: d.id,
        balanceMinor: d.outstanding.amountMinor,
        annualRateBps: d.annualRateBps,
        minimumPaymentMinor: d.monthlyPayment.amountMinor,
      })),
      strategy,
      extraMonthly.amountMinor,
      toLocalDate(today),
    );
    return toDomainPlan(plan, extraMonthly, currency, today);
  } catch (error) {
    if (error instanceof PaymentTooLowError) throw new DebtError('invalid');
    throw error;
  }
}

function toDomainPlan(
  plan: EnginePlan,
  extraMonthly: Money,
  currency: Money['currency'],
  today: Date,
): PayoffPlan {
  return {
    strategy: plan.strategy,
    extraMonthly,
    debts: plan.debts.map((debt) => ({
      debtId: debt.id,
      order: debt.order,
      payoffDate: fromLocalDate(debt.payoffDate),
      interestPaid: Money.ofMinor(debt.interestPaidMinor, currency),
    })),
    totalInterest: Money.ofMinor(plan.totalInterestMinor, currency),
    debtFreeDate: plan.debtFreeDate ? fromLocalDate(plan.debtFreeDate) : today,
  };
}
