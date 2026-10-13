import { describe, expect, it } from 'vitest';

import {
  amortizationSchedule,
  frenchInstallment,
  monthlyRate,
  outstandingBalance,
  PaymentTooLowError,
  simulateExtraPayment,
} from '../index.ts';

/** Number of payments from the closed form NPER = −ln(1 − P·i/A) / ln(1 + i), rounded up. */
function nper(principal: number, annualRateBps: number, payment: number): number {
  const i = monthlyRate(annualRateBps);
  return Math.ceil(-Math.log(1 - (principal * i) / payment) / Math.log(1 + i));
}

describe('frenchInstallment', () => {
  it.each([
    // Reference values from any bank / spreadsheet PMT().
    ['10.000 € at 5 % over 12 months', 1_000_000, 500, 12, 85_607],
    ['200.000 € mortgage at 3 % over 30 years', 20_000_000, 300, 360, 84_321],
    ['8.640 € at 6,9 % over 30 months', 864_000, 690, 30, 31_438],
    ['interest-free 1.200 € over 12 months', 120_000, 0, 12, 10_000],
  ])('%s → %i cents', (_, principal, rateBps, months, expected) => {
    expect(frenchInstallment(principal, rateBps, months)).toBe(expected);
  });

  it('rejects fractions of a cent and invalid terms', () => {
    expect(() => frenchInstallment(10.5, 500, 12)).toThrow(RangeError);
    expect(() => frenchInstallment(100_000, 500, 0)).toThrow(RangeError);
    expect(() => frenchInstallment(100_000, 6.9, 12)).toThrow(RangeError);
  });
});

describe('amortizationSchedule', () => {
  const loan = {
    principalMinor: 1_000_000,
    annualRateBps: 500,
    paymentMinor: 85_607,
    firstPaymentDate: '2026-01-31',
    termMonths: 12,
  };

  it('matches the reference table of a 10.000 € loan at 5 %', () => {
    const { rows, totalInterestMinor } = amortizationSchedule(loan);

    expect(rows[0]).toEqual({
      period: 1,
      date: '2026-01-31',
      paymentMinor: 85_607,
      interestMinor: 4_167, // 10.000 × 0,05 / 12 = 41,666… → 41,67 €
      principalMinor: 81_440,
      balanceMinor: 918_560,
    });
    expect(rows).toHaveLength(12);
    // The 12th instalment absorbs the 5 cents of rounding residual: 856,12 €.
    expect(rows.at(-1)!.paymentMinor).toBe(85_612);
    expect(totalInterestMinor).toBe(27_289);
  });

  it('keeps the invariants: principal adds up and the balance ends at exactly 0', () => {
    const { rows, totalInterestMinor, totalPaidMinor } = amortizationSchedule(loan);

    expect(rows.reduce((sum, row) => sum + row.principalMinor, 0)).toBe(loan.principalMinor);
    expect(rows.at(-1)!.balanceMinor).toBe(0);
    expect(totalPaidMinor - totalInterestMinor).toBe(loan.principalMinor);
    for (const row of rows) {
      expect(Number.isInteger(row.interestMinor) && Number.isInteger(row.balanceMinor)).toBe(true);
    }
  });

  it('keeps the payment day, clamping it in short months', () => {
    const dates = amortizationSchedule(loan)
      .rows.slice(0, 4)
      .map((row) => row.date);

    expect(dates).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  });

  it('refuses payments that do not even cover the interest', () => {
    expect(() => amortizationSchedule({ ...loan, paymentMinor: 4_000 })).toThrow(
      PaymentTooLowError,
    );
  });
});

describe('the canvas example: car of 8.640 € at 6,9 % paying 320 €/month', () => {
  const car = {
    principalMinor: 864_000,
    annualRateBps: 690,
    paymentMinor: 32_000,
    firstPaymentDate: '2026-11-05',
  };

  it('ends after 30 payments, as the closed form predicts', () => {
    const { rows, payoffDate } = amortizationSchedule(car);

    expect(rows).toHaveLength(nper(864_000, 690, 32_000));
    expect(rows).toHaveLength(30);
    expect(rows[0]).toMatchObject({ interestMinor: 4_968, principalMinor: 27_032 });
    expect(rows[1]).toMatchObject({ interestMinor: 4_813, balanceMinor: 809_781 });
    expect(payoffDate).toBe('2029-04-05');
  });

  it('with +100 €/month: 8 months earlier and 194,83 € less interest', () => {
    const simulation = simulateExtraPayment(car, 10_000);

    expect(simulation.withExtra.months).toBe(nper(864_000, 690, 42_000));
    expect(simulation).toEqual({
      baseline: { months: 30, totalInterestMinor: 77_654, payoffDate: '2029-04-05' },
      withExtra: { months: 22, totalInterestMinor: 58_171, payoffDate: '2028-08-05' },
      monthsSaved: 8,
      interestSavedMinor: 19_483,
    });
  });

  it('knows what is still owed on any date', () => {
    expect(outstandingBalance(car, '2026-10-01')).toBe(864_000);
    expect(outstandingBalance(car, '2026-11-05')).toBe(836_968);
    expect(outstandingBalance(car, '2026-12-04')).toBe(836_968);
    expect(outstandingBalance(car, '2030-01-01')).toBe(0);
  });
});
