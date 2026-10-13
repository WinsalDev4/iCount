import { Money } from '@/core/domain/Money';

import type { Transaction } from '../../Transaction';
import type { TransactionRepository } from '../../TransactionRepository';
import { GetMonthlySummary } from '../GetMonthlySummary';

let nextId = 0;
const tx = (overrides: Partial<Transaction>): Transaction => ({
  id: String(nextId++),
  type: 'expense',
  amount: Money.ofMinor(0, 'EUR'),
  categoryId: 'other',
  description: '',
  occurredAt: new Date('2026-10-01'),
  householdId: 'home',
  ...overrides,
});

const repositoryReturning = (transactions: Transaction[]): TransactionRepository => ({
  findByMonth: jest.fn().mockResolvedValue(transactions),
});

describe('GetMonthlySummary', () => {
  it('computes income, expenses, balance and per-category totals', async () => {
    const repository = repositoryReturning([
      tx({ type: 'income', amount: Money.ofMinor(250_000, 'EUR'), categoryId: 'salary' }),
      tx({ amount: Money.ofMinor(12_050, 'EUR'), categoryId: 'food' }),
      tx({ amount: Money.ofMinor(3_000, 'EUR'), categoryId: 'food' }),
      tx({ amount: Money.ofMinor(80_000, 'EUR'), categoryId: 'housing' }),
    ]);

    const summary = await new GetMonthlySummary(repository, 'EUR').execute('home', {
      year: 2026,
      month: 10,
    });

    expect(summary.income.amountMinor).toBe(250_000);
    expect(summary.expenses.amountMinor).toBe(95_050);
    expect(summary.balance.amountMinor).toBe(154_950);
    expect(summary.expensesByCategory.get('food')?.amountMinor).toBe(15_050);
    expect(summary.expensesByCategory.has('salary')).toBe(false);
  });

  it('returns zeros for a month without transactions', async () => {
    const summary = await new GetMonthlySummary(repositoryReturning([]), 'EUR').execute('home', {
      year: 2026,
      month: 1,
    });

    expect(summary.balance.amountMinor).toBe(0);
    expect(summary.expensesByCategory.size).toBe(0);
  });
});
