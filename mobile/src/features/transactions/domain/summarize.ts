import { Money, type CurrencyCode } from '@/core/domain/Money';

import type { MonthlySummary } from './MonthlySummary';
import type { CategoryId, DailyTotal, Transaction } from './Transaction';

/** Income, expenses, balance and expenses per category of a list of movements. */
export function summarizeTransactions(
  transactions: readonly Transaction[],
  currency: CurrencyCode,
): MonthlySummary {
  let income = Money.zero(currency);
  let expenses = Money.zero(currency);
  const expensesByCategory = new Map<CategoryId, Money>();

  for (const tx of transactions) {
    if (tx.type === 'income') {
      income = income.plus(tx.amount);
      continue;
    }
    expenses = expenses.plus(tx.amount);
    const current = expensesByCategory.get(tx.categoryId) ?? Money.zero(currency);
    expensesByCategory.set(tx.categoryId, current.plus(tx.amount));
  }

  return { income, expenses, balance: income.minus(expenses), expensesByCategory };
}

/** One entry per local day that has movements, oldest first. */
export function totalsByDay(
  transactions: readonly Transaction[],
  currency: CurrencyCode,
): DailyTotal[] {
  const days = new Map<number, { date: Date; income: Money; expenses: Money }>();

  for (const tx of transactions) {
    const date = new Date(
      tx.occurredAt.getFullYear(),
      tx.occurredAt.getMonth(),
      tx.occurredAt.getDate(),
    );
    const key = date.getTime();
    const day = days.get(key) ?? {
      date,
      income: Money.zero(currency),
      expenses: Money.zero(currency),
    };
    if (tx.type === 'income') day.income = day.income.plus(tx.amount);
    else day.expenses = day.expenses.plus(tx.amount);
    days.set(key, day);
  }

  return [...days.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
}
