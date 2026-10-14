import { Money } from '@/core/domain/Money';

import { summarizeTransactions, totalsByDay } from '../summarize';
import type { CategoryId, Transaction } from '../Transaction';

const eur = (cents: number) => Money.ofMinor(cents, 'EUR');

function tx(
  id: string,
  type: Transaction['type'],
  cents: number,
  category: string,
  date: Date,
): Transaction {
  return {
    id,
    type,
    amount: eur(cents),
    categoryId: category as CategoryId,
    description: '',
    occurredAt: date,
    householdId: 'h',
    payerId: 'u' as never,
    shared: false,
    shares: [],
  };
}

describe('summarizeTransactions', () => {
  it('is all zeros for no movements', () => {
    const summary = summarizeTransactions([], 'EUR');
    expect(summary.income.amountMinor).toBe(0);
    expect(summary.balance.amountMinor).toBe(0);
    expect(summary.expensesByCategory.size).toBe(0);
  });

  it('adds income and expenses and computes the balance', () => {
    const summary = summarizeTransactions(
      [
        tx('1', 'income', 100_000, 'salary', new Date(2026, 9, 1)),
        tx('2', 'expense', 30_000, 'housing', new Date(2026, 9, 1)),
        tx('3', 'expense', 5_050, 'food', new Date(2026, 9, 2)),
        tx('4', 'expense', 4_950, 'food', new Date(2026, 9, 3)),
      ],
      'EUR',
    );
    expect(summary.income.amountMinor).toBe(100_000);
    expect(summary.expenses.amountMinor).toBe(40_000);
    expect(summary.balance.amountMinor).toBe(60_000);
    expect(summary.expensesByCategory.get('food' as CategoryId)?.amountMinor).toBe(10_000);
  });

  it('a negative balance is possible', () => {
    const summary = summarizeTransactions([tx('1', 'expense', 500, 'food', new Date())], 'EUR');
    expect(summary.balance.isNegative()).toBe(true);
  });

  it('does not count incomes as spending per category', () => {
    const summary = summarizeTransactions([tx('1', 'income', 500, 'salary', new Date())], 'EUR');
    expect(summary.expensesByCategory.size).toBe(0);
  });
});

describe('totalsByDay', () => {
  it('groups by local day regardless of the time and sorts oldest first', () => {
    const days = totalsByDay(
      [
        tx('1', 'expense', 1_000, 'food', new Date(2026, 9, 5, 23, 59)),
        tx('2', 'expense', 500, 'food', new Date(2026, 9, 5, 0, 1)),
        tx('3', 'income', 9_000, 'salary', new Date(2026, 9, 2, 10)),
      ],
      'EUR',
    );
    expect(days.map((d) => d.date.getDate())).toEqual([2, 5]);
    expect(days[1]?.expenses.amountMinor).toBe(1_500);
    expect(days[0]?.income.amountMinor).toBe(9_000);
    expect(days[0]?.date).toEqual(new Date(2026, 9, 2));
  });

  it('returns nothing for no movements', () => {
    expect(totalsByDay([], 'EUR')).toEqual([]);
  });
});
