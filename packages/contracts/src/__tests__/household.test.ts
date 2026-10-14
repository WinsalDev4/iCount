import { describe, expect, it } from 'vitest';

import {
  createHouseholdRequestSchema,
  householdDtoSchema,
  inviteCodeSchema,
  setMemberIncomeRequestSchema,
  splitRuleResponseSchema,
  splitRuleSchema,
} from '../index.ts';

const ana = '0199e0a4-5b2c-7c3d-9e4f-0000000000a1';
const luis = '0199e0a4-5b2c-7c3d-9e4f-0000000000b2';

describe('splitRuleSchema', () => {
  it.each([{ type: 'equal' }, { type: 'income-proportional' }])('accepts %j', (rule) => {
    expect(splitRuleSchema.parse(rule)).toEqual(rule);
  });

  it('accepts custom shares per category that add up to 100 %', () => {
    const rule = {
      type: 'custom',
      categories: [
        {
          categoryId: 'housing',
          shares: [
            { memberId: ana, basisPoints: 6_000 },
            { memberId: luis, basisPoints: 4_000 },
          ],
        },
      ],
    };
    expect(splitRuleSchema.parse(rule)).toEqual(rule);
  });

  it.each([
    ['shares that do not add up to 100 %', [{ memberId: ana, basisPoints: 9_999 }]],
    [
      'a member listed twice',
      [
        { memberId: ana, basisPoints: 5_000 },
        { memberId: ana, basisPoints: 5_000 },
      ],
    ],
    ['fractional basis points', [{ memberId: ana, basisPoints: 10_000.5 }]],
    ['no shares', []],
  ])('rejects %s', (_, shares) => {
    const rule = { type: 'custom', categories: [{ categoryId: 'food', shares }] };
    expect(splitRuleSchema.safeParse(rule).success).toBe(false);
  });

  it('rejects the same category twice and unknown rule types', () => {
    const shares = [{ memberId: ana, basisPoints: 10_000 }];
    expect(
      splitRuleSchema.safeParse({
        type: 'custom',
        categories: [
          { categoryId: 'food', shares },
          { categoryId: 'food', shares },
        ],
      }).success,
    ).toBe(false);
    expect(splitRuleSchema.safeParse({ type: 'by-age' }).success).toBe(false);
  });

  it('is strict about categories in requests but tolerant in responses', () => {
    const rule = {
      type: 'custom',
      categories: [{ categoryId: 'pets', shares: [{ memberId: ana, basisPoints: 10_000 }] }],
    };
    expect(splitRuleSchema.safeParse(rule).success).toBe(false);
    expect(splitRuleResponseSchema.parse(rule)).toMatchObject({
      categories: [{ categoryId: 'other' }],
    });
  });
});

describe('inviteCodeSchema', () => {
  it('normalises what people type or dictate', () => {
    expect(inviteCodeSchema.parse('abcd-2345')).toBe('ABCD2345');
    expect(inviteCodeSchema.parse(' hjkm npqr ')).toBe('HJKMNPQR');
  });

  it.each(['ABCD234', 'ABCD23456', 'ABCD0345', 'ABCDO345', 'ABCD1345', 'ABCDI345', 'ABCDL345'])(
    'rejects %j (length or look-alike characters)',
    (code) => {
      expect(inviteCodeSchema.safeParse(code).success).toBe(false);
    },
  );
});

describe('household requests and responses', () => {
  it('defaults the currency to EUR and trims the name', () => {
    expect(createHouseholdRequestSchema.parse({ name: ' Casa ', kind: 'shared' })).toEqual({
      name: 'Casa',
      kind: 'shared',
      currency: 'EUR',
    });
  });

  it('rejects empty names and negative incomes', () => {
    expect(createHouseholdRequestSchema.safeParse({ name: '  ', kind: 'shared' }).success).toBe(
      false,
    );
    expect(
      setMemberIncomeRequestSchema.safeParse({
        monthlyIncome: { amountMinor: -1, currency: 'EUR' },
      }).success,
    ).toBe(false);
  });

  it('parses a household with its members', () => {
    const household = {
      id: '0199e0a4-5b2c-7c3d-9e4f-0000000000c3',
      name: 'Piso Lavapiés',
      kind: 'shared',
      currency: 'EUR',
      splitRule: { type: 'income-proportional' },
      members: [
        {
          userId: ana,
          email: 'ana@icount.app',
          displayName: 'Ana',
          role: 'admin',
          monthlyIncome: { amountMinor: 245_000, currency: 'EUR' },
          joinedAt: '2026-10-14T08:00:00.000Z',
        },
      ],
      createdAt: '2026-10-14T08:00:00.000Z',
    };
    expect(householdDtoSchema.parse(household)).toEqual(household);
    expect(householdDtoSchema.safeParse({ ...household, members: [] }).success).toBe(false);
  });
});
