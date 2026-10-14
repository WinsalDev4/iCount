import { Money } from '@/core/domain/Money';

import { InMemoryTransactionRepository } from '../../../data/InMemoryTransactionRepository';
import type { CategoryId, Transaction } from '../../Transaction';
import { GetDailyAllowance } from '../GetDailyAllowance';
import { GetRecentTransactions } from '../GetRecentTransactions';
import { GetWeeklySpending } from '../GetWeeklySpending';

const eur = (cents: number) => Money.ofMinor(cents, 'EUR');
// Wednesday 14 October 2026, 15:30 → 18 days left in the month, week 12–18 Oct.
const TODAY = new Date(2026, 9, 14, 15, 30);

let counter = 0;
function tx(
  type: Transaction['type'],
  cents: number,
  date: Date,
  description = '',
  householdId = 'h1',
): Transaction {
  counter += 1;
  return {
    id: `t${counter}`,
    type,
    amount: eur(cents),
    categoryId: 'food' as CategoryId,
    description,
    occurredAt: date,
    householdId,
    payerId: 'u' as never,
    shared: false,
    shares: [],
  };
}

const repo = (transactions: Transaction[]) =>
  new InMemoryTransactionRepository({ transactions, now: () => TODAY });

describe('GetDailyAllowance', () => {
  it('uses the balance of the month so far and what was spent today', async () => {
    const repository = repo([
      tx('income', 200_000, new Date(2026, 9, 1)),
      tx('expense', 10_000, new Date(2026, 9, 3)),
      tx('expense', 9_000, new Date(2026, 9, 14)), // today
    ]);
    // Balance 1.810 €; the day started with 1.900 € → 105,55 € a day; 90 € spent → 15,55 € left.
    const result = await new GetDailyAllowance(repository, 'EUR').execute('h1', TODAY);
    expect(result.monthBalance.amountMinor).toBe(181_000);
    expect(result.spentToday.amountMinor).toBe(9_000);
    expect(result.dailyAllowance.amountMinor).toBe(10_555);
    expect(result.leftToday.amountMinor).toBe(1_555);
  });

  it('ignores movements dated after today and other months and households', async () => {
    const repository = repo([
      tx('income', 100_000, new Date(2026, 9, 1)),
      tx('expense', 50_000, new Date(2026, 9, 20)), // a rent entered ahead of time
      tx('expense', 70_000, new Date(2026, 8, 30)), // September
      tx('expense', 99_999, new Date(2026, 9, 5), '', 'other-household'),
    ]);
    const result = await new GetDailyAllowance(repository, 'EUR').execute('h1', TODAY);
    expect(result.monthBalance.amountMinor).toBe(100_000);
    expect(result.status).toBe('on-track');
  });

  it('counts incomes of today in the balance but not as spending', async () => {
    const repository = repo([tx('income', 30_000, new Date(2026, 9, 14))]);
    const result = await new GetDailyAllowance(repository, 'EUR').execute('h1', TODAY);
    expect(result.spentToday.amountMinor).toBe(0);
    expect(result.monthBalance.amountMinor).toBe(30_000);
  });

  it('an empty month is a deficit with zero allowance', async () => {
    const result = await new GetDailyAllowance(repo([]), 'EUR').execute('h1', TODAY);
    expect(result.status).toBe('month-in-deficit');
    expect(result.dailyAllowance.amountMinor).toBe(0);
  });
});

describe('GetWeeklySpending', () => {
  const data = [
    tx('expense', 1_000, new Date(2026, 9, 12)), // Monday
    tx('expense', 500, new Date(2026, 9, 12)),
    tx('expense', 2_000, new Date(2026, 9, 14)), // today
    tx('expense', 700, new Date(2026, 9, 17)), // Saturday, ahead of today
    tx('income', 9_999, new Date(2026, 9, 13)), // incomes never count
    tx('expense', 4_000, new Date(2026, 9, 11)), // previous Sunday
    tx('expense', 4_000, new Date(2026, 9, 19)), // next Monday
  ];

  it('returns seven days Monday to Sunday with the spending of each', async () => {
    const week = await new GetWeeklySpending(repo(data), 'EUR').execute('h1', TODAY);
    expect(week).toHaveLength(7);
    expect(week.map((d) => d.date.getDate())).toEqual([12, 13, 14, 15, 16, 17, 18]);
    expect(week.map((d) => d.spent.amountMinor)).toEqual([1_500, 0, 2_000, 0, 0, 700, 0]);
  });

  it('flags today and the days still to come', async () => {
    const week = await new GetWeeklySpending(repo(data), 'EUR').execute('h1', TODAY);
    expect(week.map((d) => d.isToday)).toEqual([false, false, true, false, false, false, false]);
    expect(week.map((d) => d.isFuture)).toEqual([false, false, false, true, true, true, true]);
  });

  it('a week that spans two months is complete', async () => {
    const oct1 = new Date(2026, 9, 1, 9); // Thursday: week of 28 Sep – 4 Oct
    const repository = repo([
      tx('expense', 100, new Date(2026, 8, 29)),
      tx('expense', 200, new Date(2026, 9, 2)),
    ]);
    const week = await new GetWeeklySpending(repository, 'EUR').execute('h1', oct1);
    expect(week.map((d) => d.spent.amountMinor)).toEqual([0, 100, 0, 0, 200, 0, 0]);
  });

  it('walks every page: more than 100 movements in a week are all counted', async () => {
    const many = Array.from({ length: 130 }, () => tx('expense', 10, new Date(2026, 9, 13)));
    const week = await new GetWeeklySpending(repo(many), 'EUR').execute('h1', TODAY);
    expect(week[1]?.spent.amountMinor).toBe(1_300);
  });

  it('an empty week is seven zeros', async () => {
    const week = await new GetWeeklySpending(repo([]), 'EUR').execute('h1', TODAY);
    expect(week.every((d) => d.spent.amountMinor === 0)).toBe(true);
  });
});

describe('GetRecentTransactions', () => {
  it('returns the latest N newest first', async () => {
    const repository = repo([
      tx('expense', 1, new Date(2026, 9, 1), 'a'),
      tx('expense', 2, new Date(2026, 9, 9), 'b'),
      tx('expense', 3, new Date(2026, 9, 5), 'c'),
      tx('expense', 4, new Date(2026, 9, 12), 'd'),
    ]);
    const recent = await new GetRecentTransactions(repository).execute('h1', 3);
    expect(recent.map((t) => t.description)).toEqual(['d', 'b', 'c']);
  });

  it('defaults to four and copes with fewer', async () => {
    const repository = repo([tx('expense', 1, new Date(2026, 9, 1))]);
    expect(await new GetRecentTransactions(repository).execute('h1')).toHaveLength(1);
    const five = repo(
      Array.from({ length: 5 }, (_, i) => tx('expense', 1, new Date(2026, 9, i + 1))),
    );
    expect(await new GetRecentTransactions(five).execute('h1')).toHaveLength(4);
  });
});
