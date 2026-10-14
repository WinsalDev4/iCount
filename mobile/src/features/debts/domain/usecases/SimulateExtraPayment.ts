import { PaymentTooLowError, simulateExtraPayment } from '@icount/finance';

import { Money } from '@/core/domain/Money';
import { fromLocalDate, toLocalDate } from '@/features/transactions/data/api/transactionMapper';

import type { Debt } from '../Debt';
import { nextInstallmentDate } from '../debtMath';
import { DebtError } from '../DebtError';

export interface ExtraPaymentResult {
  readonly extraMonthly: Money;
  readonly baselineMonths: number;
  readonly withExtraMonths: number;
  readonly monthsSaved: number;
  readonly baselineInterest: Money;
  readonly withExtraInterest: Money;
  readonly interestSaved: Money;
  readonly baselinePayoffDate: Date | null;
  readonly newPayoffDate: Date | null;
}

/**
 * "And if I paid 100 € more every month?": runs the amortisation with and without the extra on
 * the DEVICE (@icount/finance), so it answers instantly and works offline. The simulation starts
 * from what is owed today and the next instalment, not from the original loan.
 */
export class SimulateExtraPayment {
  /** Returns `null` for a debt that is already paid off or has no instalments left. */
  execute(debt: Debt, extraMonthly: Money, today: Date): ExtraPaymentResult | null {
    if (extraMonthly.amountMinor < 0) throw new DebtError('invalid');
    const next = nextInstallmentDate(debt, today);
    if (debt.outstanding.amountMinor <= 0 || next === null) return null;

    try {
      const simulation = simulateExtraPayment(
        {
          principalMinor: debt.outstanding.amountMinor,
          annualRateBps: debt.annualRateBps,
          paymentMinor: debt.monthlyPayment.amountMinor,
          firstPaymentDate: toLocalDate(next),
        },
        extraMonthly.amountMinor,
      );
      const currency = debt.outstanding.currency;
      const date = (value: string | null) => (value ? fromLocalDate(value) : null);
      return {
        extraMonthly,
        baselineMonths: simulation.baseline.months,
        withExtraMonths: simulation.withExtra.months,
        monthsSaved: simulation.monthsSaved,
        baselineInterest: Money.ofMinor(simulation.baseline.totalInterestMinor, currency),
        withExtraInterest: Money.ofMinor(simulation.withExtra.totalInterestMinor, currency),
        interestSaved: Money.ofMinor(simulation.interestSavedMinor, currency),
        baselinePayoffDate: date(simulation.baseline.payoffDate),
        newPayoffDate: date(simulation.withExtra.payoffDate),
      };
    } catch (error) {
      // An instalment that does not even cover the monthly interest never ends the debt.
      if (error instanceof PaymentTooLowError) throw new DebtError('invalid');
      throw error;
    }
  }
}
