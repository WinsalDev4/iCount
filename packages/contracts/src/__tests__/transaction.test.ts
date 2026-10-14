import { describe, expect, it } from 'vitest';

import {
  categoryDtoSchema,
  categoryRefResponseSchema,
  categoryRefSchema,
  createTransactionRequestSchema,
  dailyTotalsDtoSchema,
  listTransactionsQuerySchema,
  monthlySummaryDtoSchema,
  transactionDtoSchema,
  updateTransactionRequestSchema,
} from '../index.ts';

const ana = '0199e0a4-5b2c-7c3d-9e4f-0000000000a1';
const luis = '0199e0a4-5b2c-7c3d-9e4f-0000000000b2';
const eur = (amountMinor: number) => ({ amountMinor, currency: 'EUR' });

describe('category refs', () => {
  it('accept built-in keys and custom UUIDs', () => {
    expect(categoryRefSchema.parse('food')).toBe('food');
    expect(categoryRefSchema.parse(ana)).toBe(ana);
    expect(categoryRefSchema.safeParse('pets').success).toBe(false);
  });

  it('read unknown keys as other in responses', () => {
    expect(categoryRefResponseSchema.parse('pets')).toBe('other');
  });

  it('describe a category', () => {
    const category = {
      id: 'food',
      name: 'Comida',
      icon: 'cart',
      kind: 'expense',
      isDefault: true,
      householdId: null,
    };
    expect(categoryDtoSchema.parse(category)).toEqual(category);
  });
});

describe('createTransactionRequestSchema', () => {
  it('applies defaults and trims the description', () => {
    expect(
      createTransactionRequestSchema.parse({
        type: 'expense',
        amount: eur(1250),
        categoryId: 'food',
        description: '  Mercadona ',
        occurredOn: '2026-10-14',
      }),
    ).toEqual({
      type: 'expense',
      amount: eur(1250),
      categoryId: 'food',
      description: 'Mercadona',
      occurredOn: '2026-10-14',
      shared: false,
    });
  });

  it.each([
    ['a zero amount', { amount: eur(0) }],
    ['a negative amount', { amount: eur(-100) }],
    ['a date with time', { occurredOn: '2026-10-14T10:00:00Z' }],
    ['an impossible date', { occurredOn: '2026-02-30' }],
    ['a long description', { description: 'x'.repeat(141) }],
    ['an unknown type', { type: 'transfer' }],
  ])('rejects %s', (_, override) => {
    const base = {
      type: 'expense',
      amount: eur(100),
      categoryId: 'food',
      occurredOn: '2026-10-14',
    };
    expect(createTransactionRequestSchema.safeParse({ ...base, ...override }).success).toBe(false);
  });
});

describe('updateTransactionRequestSchema', () => {
  it('accepts partial changes but not an empty patch', () => {
    expect(updateTransactionRequestSchema.parse({ description: 'Luz' })).toEqual({
      description: 'Luz',
    });
    expect(updateTransactionRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe('listTransactionsQuerySchema', () => {
  it('parses query string filters', () => {
    expect(
      listTransactionsQuerySchema.parse({
        limit: '10',
        shared: 'false',
        from: '2026-10-01',
        to: '2026-10-31',
        q: ' luz ',
      }),
    ).toEqual({ limit: 10, shared: false, from: '2026-10-01', to: '2026-10-31', q: 'luz' });
  });

  it('rejects ambiguous booleans', () => {
    expect(listTransactionsQuerySchema.safeParse({ shared: 'yes' }).success).toBe(false);
  });
});

describe('transaction responses', () => {
  it('parse a shared movement with its shares', () => {
    const transaction = {
      id: '0199e0a4-5b2c-7c3d-9e4f-0000000000d4',
      householdId: '0199e0a4-5b2c-7c3d-9e4f-0000000000c3',
      type: 'expense',
      amount: eur(1001),
      categoryId: 'bills',
      description: 'Luz',
      occurredOn: '2026-10-06',
      payerId: ana,
      shared: true,
      shares: [
        { memberId: ana, amount: eur(501) },
        { memberId: luis, amount: eur(500) },
      ],
      createdAt: '2026-10-06T09:00:00.000Z',
      updatedAt: '2026-10-06T09:00:00.000Z',
    };
    expect(transactionDtoSchema.parse(transaction)).toEqual(transaction);
  });

  it('parse monthly summaries and daily totals', () => {
    expect(
      monthlySummaryDtoSchema.parse({
        month: '2026-10',
        income: eur(245_000),
        expenses: eur(137_825),
        balance: eur(107_175),
        expensesByCategory: [{ categoryId: 'housing', amount: eur(85_000) }],
      }).balance.amountMinor,
    ).toBe(107_175);
    expect(
      dailyTotalsDtoSchema.safeParse({
        month: '2026-13',
        days: [],
      }).success,
    ).toBe(false);
  });
});
