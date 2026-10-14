import { describe, expect, it } from 'vitest';

import { type SplitMember, splitAmount } from '../index.ts';

const members: SplitMember[] = [
  { id: 'ana', monthlyIncomeMinor: 300_000 },
  { id: 'leo', monthlyIncomeMinor: 200_000 },
  { id: 'eva', monthlyIncomeMinor: 100_000 },
];
const sum = (shares: { amountMinor: number }[]) => shares.reduce((s, x) => s + x.amountMinor, 0);

describe('splitAmount', () => {
  it('splits equally and gives the leftover cent to the payer', () => {
    const shares = splitAmount({
      amountMinor: 1_001,
      payerId: 'leo',
      members,
      rule: { type: 'equal' },
      categoryId: 'food',
    });

    expect(shares).toEqual([
      { memberId: 'ana', amountMinor: 333 },
      { memberId: 'leo', amountMinor: 335 },
      { memberId: 'eva', amountMinor: 333 },
    ]);
    expect(sum(shares)).toBe(1_001);
  });

  it('splits in proportion to declared incomes (3:2:1)', () => {
    const shares = splitAmount({
      amountMinor: 60_001,
      payerId: 'ana',
      members,
      rule: { type: 'income-proportional' },
      categoryId: 'housing',
    });

    expect(shares.map((s) => s.amountMinor)).toEqual([30_001, 20_000, 10_000]);
  });

  it('falls back to equal parts when an income is missing', () => {
    const shares = splitAmount({
      amountMinor: 900,
      payerId: 'ana',
      members: [...members.slice(0, 2), { id: 'eva', monthlyIncomeMinor: null }],
      rule: { type: 'income-proportional' },
      categoryId: 'housing',
    });

    expect(shares.map((s) => s.amountMinor)).toEqual([300, 300, 300]);
  });

  it('applies custom basis points per category and equal parts elsewhere', () => {
    const rule = {
      type: 'custom' as const,
      categories: [
        {
          categoryId: 'housing',
          shares: [
            { memberId: 'ana', basisPoints: 6_000 },
            { memberId: 'leo', basisPoints: 4_000 },
          ],
        },
      ],
    };

    const housing = splitAmount({
      amountMinor: 85_001,
      payerId: 'leo',
      members,
      rule,
      categoryId: 'housing',
    });
    expect(housing.map((s) => s.amountMinor)).toEqual([51_000, 34_001, 0]);

    const food = splitAmount({
      amountMinor: 3_000,
      payerId: 'ana',
      members,
      rule,
      categoryId: 'food',
    });
    expect(food.map((s) => s.amountMinor)).toEqual([1_000, 1_000, 1_000]);
  });

  it('never loses or creates a cent, whatever the numbers', () => {
    for (let amount = 0; amount < 2_000; amount += 7) {
      for (const rule of [{ type: 'equal' as const }, { type: 'income-proportional' as const }]) {
        expect(
          sum(splitAmount({ amountMinor: amount, payerId: 'eva', members, rule, categoryId: 'x' })),
        ).toBe(amount);
      }
    }
  });

  it('stays exact with very large amounts and incomes (BigInt)', () => {
    const rich: SplitMember[] = [
      { id: 'a', monthlyIncomeMinor: 9_000_000_000_000 },
      { id: 'b', monthlyIncomeMinor: 1_000_000_000_000 },
    ];
    const shares = splitAmount({
      amountMinor: 999_999_999_999,
      payerId: 'b',
      members: rich,
      rule: { type: 'income-proportional' },
      categoryId: 'x',
    });

    expect(sum(shares)).toBe(999_999_999_999);
    expect(shares[0]!.amountMinor).toBe(899_999_999_999);
  });

  it('rejects payers outside the household and invalid amounts', () => {
    const base = { members, rule: { type: 'equal' as const }, categoryId: 'x' };
    expect(() => splitAmount({ ...base, amountMinor: 100, payerId: 'stranger' })).toThrow(
      RangeError,
    );
    expect(() => splitAmount({ ...base, amountMinor: 10.5, payerId: 'ana' })).toThrow(RangeError);
  });
});
