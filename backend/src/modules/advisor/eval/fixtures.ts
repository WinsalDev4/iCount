import type { HouseholdSnapshot } from '../domain/snapshot.js';

/**
 * Fictional households for the advisor's evaluation set (ADR-0020). They are
 * shaped to trigger each detector, and are used by the unit tests, the offline
 * evaluation (recorded model outputs) and the live one (`npm run eval:advisor`).
 */

const categories = new Map([
  ['food', 'Comida'],
  ['leisure', 'Ocio'],
  ['subscriptions', 'Suscripciones'],
  ['transport', 'Transporte'],
  ['bills', 'Facturas'],
]);

const monthly = () => ({ unit: 'month' as const, interval: 1, dayOfMonth: 5 });

/** A couple in Madrid: duplicated streaming, overspending on leisure, an expensive card. */
export const couple: HouseholdSnapshot = {
  householdId: '0199e0a4-0000-7000-8000-00000000c001',
  currency: 'EUR',
  today: '2026-10-14',
  categoryNames: categories,
  monthlyExpenses: [
    // Ocio: 120 € on average, 310 € last month → unusual.
    { month: '2026-06', categoryId: 'leisure', amountMinor: 11_000 },
    { month: '2026-07', categoryId: 'leisure', amountMinor: 12_500 },
    { month: '2026-08', categoryId: 'leisure', amountMinor: 12_500 },
    { month: '2026-09', categoryId: 'leisure', amountMinor: 31_000 },
    { month: '2026-10', categoryId: 'leisure', amountMinor: 9_000 },
    // Comida: stable → nothing.
    { month: '2026-06', categoryId: 'food', amountMinor: 40_000 },
    { month: '2026-07', categoryId: 'food', amountMinor: 42_000 },
    { month: '2026-08', categoryId: 'food', amountMinor: 41_000 },
    { month: '2026-09', categoryId: 'food', amountMinor: 43_000 },
    { month: '2026-10', categoryId: 'food', amountMinor: 20_000 },
  ],
  budgets: [
    // Over by 35 €.
    {
      id: '0199e0a4-0000-7000-8000-0000000b0001',
      categoryId: 'food',
      month: '2026-10',
      limitMinor: 40_000,
      spentMinor: 43_500,
    },
    {
      id: '0199e0a4-0000-7000-8000-0000000b0002',
      categoryId: 'leisure',
      month: '2026-10',
      limitMinor: 15_000,
      spentMinor: 9_000,
    },
  ],
  recurring: [
    {
      id: '0199e0a4-0000-7000-8000-0000000a0001',
      name: 'Netflix Premium',
      kind: 'subscription',
      type: 'expense',
      amountMinor: 1_999,
      categoryId: 'subscriptions',
      rule: monthly(),
    },
    {
      id: '0199e0a4-0000-7000-8000-0000000a0002',
      name: 'Netflix Básico',
      kind: 'subscription',
      type: 'expense',
      amountMinor: 699,
      categoryId: 'subscriptions',
      rule: monthly(),
    },
    {
      id: '0199e0a4-0000-7000-8000-0000000a0003',
      name: 'Spotify',
      kind: 'subscription',
      type: 'expense',
      amountMinor: 1_199,
      categoryId: 'subscriptions',
      rule: monthly(),
    },
    {
      id: '0199e0a4-0000-7000-8000-0000000a0004',
      name: 'Luz',
      kind: 'bill',
      type: 'expense',
      amountMinor: 6_890,
      categoryId: 'bills',
      rule: monthly(),
    },
  ],
  debts: [
    {
      id: '0199e0a4-0000-7000-8000-0000000d0001',
      name: 'Tarjeta',
      outstandingMinor: 250_000,
      annualRateBps: 2_190,
      monthlyPaymentMinor: 12_000,
    },
    {
      id: '0199e0a4-0000-7000-8000-0000000d0002',
      name: 'Hipoteca',
      outstandingMinor: 15_000_000,
      annualRateBps: 290,
      monthlyPaymentMinor: 70_000,
    },
  ],
};

/** A tidy student flat: nothing to report. */
export const tidyFlat: HouseholdSnapshot = {
  householdId: '0199e0a4-0000-7000-8000-00000000c002',
  currency: 'EUR',
  today: '2026-10-14',
  categoryNames: categories,
  monthlyExpenses: ['2026-06', '2026-07', '2026-08', '2026-09'].map((month) => ({
    month,
    categoryId: 'food',
    amountMinor: 30_000,
  })),
  budgets: [
    {
      id: '0199e0a4-0000-7000-8000-0000000b0003',
      categoryId: 'food',
      month: '2026-10',
      limitMinor: 35_000,
      spentMinor: 12_000,
    },
  ],
  recurring: [],
  debts: [],
};

/** A yearly subscription duplicated with a monthly one (a twelfth counts per month). */
export const yearlyDuplicate: HouseholdSnapshot = {
  ...tidyFlat,
  householdId: '0199e0a4-0000-7000-8000-00000000c003',
  recurring: [
    {
      id: '0199e0a4-0000-7000-8000-0000000a0005',
      name: 'Amazon Prime anual',
      kind: 'subscription',
      type: 'expense',
      amountMinor: 4_990,
      categoryId: 'subscriptions',
      rule: { unit: 'year', interval: 1, dayOfMonth: 1, monthOfYear: 3 },
    },
    {
      id: '0199e0a4-0000-7000-8000-0000000a0006',
      name: 'Amazon Prime mensual',
      kind: 'subscription',
      type: 'expense',
      amountMinor: 499,
      categoryId: 'subscriptions',
      rule: { unit: 'month', interval: 1, dayOfMonth: 1 },
    },
  ],
};

export const EVAL_HOUSEHOLDS = { couple, tidyFlat, yearlyDuplicate } as const;
