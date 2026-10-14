import { describe, expect, it } from 'vitest';

import { type DebtInput, payoffPlan, priorityOrder } from '../index.ts';

const debts: DebtInput[] = [
  { id: 'car', balanceMinor: 864_000, annualRateBps: 690, minimumPaymentMinor: 32_000 },
  { id: 'card', balanceMinor: 150_000, annualRateBps: 2_190, minimumPaymentMinor: 6_000 },
  { id: 'loan', balanceMinor: 300_000, annualRateBps: 990, minimumPaymentMinor: 10_000 },
];

describe('priorityOrder', () => {
  it('avalanche: highest rate first; snowball: smallest balance first', () => {
    expect(priorityOrder(debts, 'avalanche').map((d) => d.id)).toEqual(['card', 'loan', 'car']);
    expect(priorityOrder(debts, 'snowball').map((d) => d.id)).toEqual(['card', 'loan', 'car']);

    const reversed: DebtInput[] = [
      {
        id: 'big-expensive',
        balanceMinor: 500_000,
        annualRateBps: 2_000,
        minimumPaymentMinor: 15_000,
      },
      { id: 'small-cheap', balanceMinor: 50_000, annualRateBps: 300, minimumPaymentMinor: 5_000 },
    ];
    expect(priorityOrder(reversed, 'avalanche')[0]!.id).toBe('big-expensive');
    expect(priorityOrder(reversed, 'snowball')[0]!.id).toBe('small-cheap');
  });

  it('breaks ties deterministically by id', () => {
    const twins: DebtInput[] = [
      { id: 'b', balanceMinor: 1_000, annualRateBps: 500, minimumPaymentMinor: 100 },
      { id: 'a', balanceMinor: 1_000, annualRateBps: 500, minimumPaymentMinor: 100 },
    ];
    expect(priorityOrder(twins, 'avalanche').map((d) => d.id)).toEqual(['a', 'b']);
  });
});

describe('payoffPlan', () => {
  it('rolls the minimum of a paid-off debt into the next one (hand-checked, 0 % rates)', () => {
    // Budget 300/month. Month 3: B ends and its 50 + the leftover flow into A.
    const plan = payoffPlan(
      [
        { id: 'A', balanceMinor: 1_000, annualRateBps: 0, minimumPaymentMinor: 100 },
        { id: 'B', balanceMinor: 500, annualRateBps: 0, minimumPaymentMinor: 50 },
      ],
      'snowball',
      150,
      '2026-11-01',
    );

    expect(plan.debts).toEqual([
      { id: 'B', order: 1, payoffDate: '2027-01-01', months: 3, interestPaidMinor: 0 },
      { id: 'A', order: 2, payoffDate: '2027-03-01', months: 5, interestPaidMinor: 0 },
    ]);
    expect(plan.debtFreeDate).toBe('2027-03-01');
    expect(plan.months).toBe(5);
  });

  it('avalanche never pays more interest than snowball', () => {
    const mixed: DebtInput[] = [
      {
        id: 'big-expensive',
        balanceMinor: 500_000,
        annualRateBps: 2_000,
        minimumPaymentMinor: 15_000,
      },
      { id: 'small-cheap', balanceMinor: 50_000, annualRateBps: 300, minimumPaymentMinor: 5_000 },
    ];
    const avalanche = payoffPlan(mixed, 'avalanche', 10_000, '2026-11-01');
    const snowball = payoffPlan(mixed, 'snowball', 10_000, '2026-11-01');

    expect(avalanche.totalInterestMinor).toBeLessThan(snowball.totalInterestMinor);
  });

  it('with only one debt and the same extra, agrees with simulateExtraPayment', async () => {
    const { simulateExtraPayment } = await import('../index.ts');
    const plan = payoffPlan([debts[0]!], 'avalanche', 10_000, '2026-11-05');
    const simulation = simulateExtraPayment(
      {
        principalMinor: 864_000,
        annualRateBps: 690,
        paymentMinor: 32_000,
        firstPaymentDate: '2026-11-05',
      },
      10_000,
    );

    expect(plan.months).toBe(simulation.withExtra.months);
    expect(plan.totalInterestMinor).toBe(simulation.withExtra.totalInterestMinor);
    expect(plan.debtFreeDate).toBe(simulation.withExtra.payoffDate);
  });

  it('extra money shortens the plan', () => {
    const without = payoffPlan(debts, 'avalanche', 0, '2026-11-01');
    const withExtra = payoffPlan(debts, 'avalanche', 20_000, '2026-11-01');

    expect(withExtra.months).toBeLessThan(without.months);
    expect(withExtra.totalInterestMinor).toBeLessThan(without.totalInterestMinor);
  });

  it('handles an empty list and rejects negative extras', () => {
    expect(payoffPlan([], 'snowball', 0, '2026-11-01')).toMatchObject({
      debts: [],
      totalInterestMinor: 0,
      debtFreeDate: null,
      months: 0,
    });
    expect(() => payoffPlan(debts, 'snowball', -1, '2026-11-01')).toThrow(RangeError);
  });
});
