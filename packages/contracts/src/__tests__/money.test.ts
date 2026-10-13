import { describe, expect, it } from 'vitest';

import { currencyCodeSchema, moneyDtoSchema } from '../index.ts';

describe('moneyDtoSchema', () => {
  it.each([
    { amountMinor: 1050, currency: 'EUR' },
    { amountMinor: 0, currency: 'USD' },
    { amountMinor: -2550, currency: 'GBP' },
    { amountMinor: Number.MAX_SAFE_INTEGER, currency: 'MXN' },
  ])('accepts $amountMinor $currency', (money) => {
    expect(moneyDtoSchema.parse(money)).toEqual(money);
  });

  it.each([
    ['decimals', { amountMinor: 10.5, currency: 'EUR' }],
    ['unsafe integers', { amountMinor: Number.MAX_SAFE_INTEGER + 1, currency: 'EUR' }],
    ['numeric strings', { amountMinor: '1050', currency: 'EUR' }],
    ['NaN', { amountMinor: Number.NaN, currency: 'EUR' }],
    ['unknown currencies', { amountMinor: 100, currency: 'JPY' }],
    ['lowercase currencies', { amountMinor: 100, currency: 'eur' }],
    ['a missing currency', { amountMinor: 100 }],
  ])('rejects %s', (_, money) => {
    expect(moneyDtoSchema.safeParse(money).success).toBe(false);
  });
});

describe('currencyCodeSchema', () => {
  it('lists the currencies supported by the app', () => {
    expect(currencyCodeSchema.options).toEqual(['EUR', 'USD', 'GBP', 'MXN']);
  });
});
