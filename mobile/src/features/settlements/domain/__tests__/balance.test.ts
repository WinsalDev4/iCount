import type { CategoryId } from '@/core/domain/Category';
import type { UserId } from '@/core/domain/Ids';
import { Money } from '@/core/domain/Money';
import type { Member } from '@/features/household/domain/Household';
import type { Transaction } from '@/features/transactions/domain/Transaction';

import { computeBalance } from '../balance';
import type { Settlement } from '../Settlement';

const A = 'a' as UserId;
const B = 'b' as UserId;
const C = 'c' as UserId;
const eur = (cents: number) => Money.ofMinor(cents, 'EUR');
const member = (id: UserId, income: number | null = null): Member => ({
  userId: id,
  email: `${id}@x.app`,
  displayName: id.toUpperCase(),
  role: 'member',
  monthlyIncome: income === null ? null : eur(income),
});
const expense = (payer: UserId, cents: number, extra: Partial<Transaction> = {}): Transaction => ({
  id: `t-${payer}-${cents}`,
  type: 'expense',
  amount: eur(cents),
  categoryId: 'food' as CategoryId,
  description: 'x',
  occurredAt: new Date(2026, 9, 1),
  householdId: 'h',
  payerId: payer,
  shared: true,
  shares: [],
  ...extra,
});
const base = { currency: 'EUR' as const, settlements: [], pendingApprovalCount: 0 };
const netOf = (b: ReturnType<typeof computeBalance>, id: UserId) =>
  b.members.find((m) => m.memberId === id)?.net.amountMinor;

describe('computeBalance', () => {
  it('splits a shared expense equally: the payer is owed the others’ part', () => {
    const balance = computeBalance({
      ...base,
      members: [member(A), member(B)],
      rule: { kind: 'equal' },
      transactions: [expense(A, 10_000)],
    });
    expect(netOf(balance, A)).toBe(5_000);
    expect(netOf(balance, B)).toBe(-5_000);
    expect(balance.suggestedTransfers).toEqual([{ from: B, to: A, amount: eur(5_000) }]);
  });

  it('nets always add up to zero, even with an indivisible cent and three members', () => {
    const balance = computeBalance({
      ...base,
      members: [member(A), member(B), member(C)],
      rule: { kind: 'equal' },
      transactions: [expense(A, 10_001), expense(B, 333), expense(C, 7)],
    });
    expect(balance.members.reduce((sum, m) => sum + m.net.amountMinor, 0)).toBe(0);
    expect(balance.suggestedTransfers.length).toBeLessThanOrEqual(2);
  });

  it('follows the income-proportional rule', () => {
    const balance = computeBalance({
      ...base,
      members: [member(A, 300_000), member(B, 100_000)],
      rule: { kind: 'income-proportional' },
      transactions: [expense(A, 10_000)],
    });
    // B owes 25 % of 100 €.
    expect(netOf(balance, B)).toBe(-2_500);
  });

  it('uses the stored shares of a movement when it has them', () => {
    const balance = computeBalance({
      ...base,
      members: [member(A), member(B)],
      rule: { kind: 'equal' },
      transactions: [
        expense(A, 10_000, {
          shares: [
            { memberId: A, amount: eur(2_000) },
            { memberId: B, amount: eur(8_000) },
          ],
        }),
      ],
    });
    expect(netOf(balance, B)).toBe(-8_000);
  });

  it('ignores movements that are not shared or whose payer left', () => {
    const balance = computeBalance({
      ...base,
      members: [member(A), member(B)],
      rule: { kind: 'equal' },
      transactions: [expense(A, 10_000, { shared: false }), expense('gone' as UserId, 5_000)],
    });
    expect(balance.suggestedTransfers).toEqual([]);
    expect(netOf(balance, A)).toBe(0);
  });

  it('a settlement brings the balance back to zero', () => {
    const settlement: Settlement = {
      id: 's',
      from: B,
      to: A,
      amount: eur(5_000),
      method: 'bizum',
      note: '',
      settledOn: new Date(2026, 9, 2),
    };
    const balance = computeBalance({
      ...base,
      members: [member(A), member(B)],
      rule: { kind: 'equal' },
      transactions: [expense(A, 10_000)],
      settlements: [settlement],
    });
    expect(netOf(balance, A)).toBe(0);
    expect(netOf(balance, B)).toBe(0);
    expect(balance.suggestedTransfers).toEqual([]);
  });

  it('a shared income counts with the opposite sign', () => {
    const balance = computeBalance({
      ...base,
      members: [member(A), member(B)],
      rule: { kind: 'equal' },
      transactions: [expense(A, 10_000, { type: 'income' })],
    });
    expect(netOf(balance, A)).toBe(-5_000);
  });

  it('passes the pending count through', () => {
    expect(
      computeBalance({
        ...base,
        members: [member(A), member(B)],
        rule: { kind: 'equal' },
        transactions: [],
        pendingApprovalCount: 3,
      }).pendingApprovalCount,
    ).toBe(3);
  });
});
