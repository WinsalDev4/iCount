import { describe, expect, it } from 'vitest';

import {
  budgetDtoSchema,
  createBudgetRequestSchema,
  createDebtRequestSchema,
  createRecurringPaymentRequestSchema,
  moveBudgetAmountRequestSchema,
  payoffStrategyQuerySchema,
  payoffStrategyResultDtoSchema,
  recurrenceRuleSchema,
  updateDebtRequestSchema,
  upcomingDueQuerySchema,
} from '../index.ts';

const eur = (amountMinor: number) => ({ amountMinor, currency: 'EUR' });
const budgetA = '0199e0a4-5b2c-7c3d-9e4f-0000000000e1';
const budgetB = '0199e0a4-5b2c-7c3d-9e4f-0000000000e2';
const debt = '0199e0a4-5b2c-7c3d-9e4f-0000000000f1';

describe('budgets', () => {
  it('accept a monthly budget and report an exceeded one with negative remaining', () => {
    expect(
      createBudgetRequestSchema.parse({ categoryId: 'food', month: '2026-10', limit: eur(40_000) }),
    ).toMatchObject({ month: '2026-10' });
    expect(
      budgetDtoSchema.parse({
        id: budgetA,
        householdId: '0199e0a4-5b2c-7c3d-9e4f-0000000000c3',
        categoryId: 'food',
        month: '2026-10',
        limit: eur(40_000),
        spent: eur(43_500),
        remaining: eur(-3_500),
      }).remaining.amountMinor,
    ).toBe(-3_500);
  });

  it('reject a zero limit and moving money to the same budget', () => {
    expect(
      createBudgetRequestSchema.safeParse({ categoryId: 'food', month: '2026-10', limit: eur(0) })
        .success,
    ).toBe(false);
    expect(
      moveBudgetAmountRequestSchema.safeParse({
        fromBudgetId: budgetA,
        toBudgetId: budgetA,
        amount: eur(1_000),
      }).success,
    ).toBe(false);
    expect(
      moveBudgetAmountRequestSchema.safeParse({
        fromBudgetId: budgetA,
        toBudgetId: budgetB,
        amount: eur(1_000),
      }).success,
    ).toBe(true);
  });
});

describe('debts', () => {
  const carLoan = {
    name: 'Coche',
    kind: 'car',
    principal: eur(864_000),
    annualRateBps: 690,
    startDate: '2026-01-05',
    termMonths: 30,
  };

  it('accept the canvas car loan without an explicit instalment', () => {
    expect(createDebtRequestSchema.parse(carLoan)).toEqual(carLoan);
  });

  it.each([
    ['a fractional rate', { annualRateBps: 6.9 }],
    ['a negative rate', { annualRateBps: -1 }],
    ['a zero term', { termMonths: 0 }],
    ['an unknown kind', { kind: 'boat' }],
  ])('reject %s', (_, override) => {
    expect(createDebtRequestSchema.safeParse({ ...carLoan, ...override }).success).toBe(false);
  });

  it('do not accept empty patches', () => {
    expect(updateDebtRequestSchema.safeParse({}).success).toBe(false);
    expect(updateDebtRequestSchema.parse({ monthlyPayment: eur(42_000) })).toEqual({
      monthlyPayment: eur(42_000),
    });
  });

  it('parse strategy queries and results', () => {
    expect(
      payoffStrategyQuerySchema.parse({ strategy: 'avalanche', extraMonthlyMinor: '10000' }),
    ).toEqual({ strategy: 'avalanche', extraMonthlyMinor: 10_000 });
    expect(payoffStrategyQuerySchema.parse({ strategy: 'snowball' }).extraMonthlyMinor).toBe(0);
    expect(
      payoffStrategyResultDtoSchema.safeParse({
        strategy: 'snowball',
        extraMonthly: eur(10_000),
        debts: [{ debtId: debt, order: 1, payoffDate: '2028-03-05', interestPaid: eur(52_210) }],
        totalInterest: eur(52_210),
        debtFreeDate: '2028-03-05',
      }).success,
    ).toBe(true);
    // Nothing to pay: already debt free.
    expect(
      payoffStrategyResultDtoSchema.safeParse({
        strategy: 'avalanche',
        extraMonthly: eur(0),
        debts: [],
        totalInterest: eur(0),
        debtFreeDate: null,
      }).success,
    ).toBe(true);
  });
});

describe('recurring payments', () => {
  it.each([
    { unit: 'month', interval: 1, dayOfMonth: 5 },
    { unit: 'month', interval: 3, dayOfMonth: 31 },
    { unit: 'year', interval: 1, dayOfMonth: 15, monthOfYear: 6 },
  ])('accept the rule %j', (rule) => {
    expect(recurrenceRuleSchema.parse(rule)).toEqual(rule);
  });

  it.each([
    { unit: 'year', interval: 1, dayOfMonth: 15 },
    { unit: 'month', interval: 1, dayOfMonth: 5, monthOfYear: 2 },
    { unit: 'month', interval: 0, dayOfMonth: 5 },
    { unit: 'month', interval: 1, dayOfMonth: 32 },
    { unit: 'week', interval: 1, dayOfMonth: 1 },
  ])('reject the rule %j', (rule) => {
    expect(recurrenceRuleSchema.safeParse(rule).success).toBe(false);
  });

  it('default to not shared and validate the upcoming range', () => {
    expect(
      createRecurringPaymentRequestSchema.parse({
        name: 'Luz',
        kind: 'bill',
        type: 'expense',
        amount: eur(6_890),
        categoryId: 'bills',
        rule: { unit: 'month', interval: 1, dayOfMonth: 6 },
        startDate: '2026-10-06',
      }).shared,
    ).toBe(false);
    expect(upcomingDueQuerySchema.safeParse({ from: '2026-11-01', to: '2026-10-01' }).success).toBe(
      false,
    );
  });
});
