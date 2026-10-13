import type { UserId } from '@/core/domain/Ids';
import { Money } from '@/core/domain/Money';
import type { Page } from '@/core/domain/Page';

import type { MonthlySummary } from '../domain/MonthlySummary';
import type {
  CategoryId,
  DailyTotal,
  Transaction,
  TransactionType,
  YearMonth,
} from '../domain/Transaction';
import type { TransactionRepository } from '../domain/TransactionRepository';

/** The signed-in member in memory mode (until auth exists). */
export const IN_MEMORY_USER_ID = 'me' as UserId;

/**
 * Temporary data source until the backend exists. Swapping it for an
 * `ApiTransactionRepository` only touches the composition root (core/di).
 * Methods added in task 3.0 are filled in by the phase 3 tasks (B-3.x).
 */
export class InMemoryTransactionRepository implements TransactionRepository {
  constructor(private readonly transactions: Transaction[] = seed()) {}

  async findByMonth(householdId: string, { year, month }: YearMonth): Promise<Transaction[]> {
    return this.transactions.filter(
      (tx) =>
        tx.householdId === householdId &&
        tx.occurredAt.getFullYear() === year &&
        tx.occurredAt.getMonth() + 1 === month,
    );
  }

  list(): Promise<Page<Transaction>> {
    return notYet('list');
  }

  getById(): Promise<Transaction | null> {
    return notYet('getById');
  }

  create(): Promise<Transaction> {
    return notYet('create');
  }

  update(): Promise<Transaction> {
    return notYet('update');
  }

  delete(): Promise<void> {
    return notYet('delete');
  }

  monthlySummary(): Promise<MonthlySummary> {
    return notYet('monthlySummary');
  }

  dailyTotals(): Promise<readonly DailyTotal[]> {
    return notYet('dailyTotals');
  }
}

function notYet<T>(method: string): Promise<T> {
  return Promise.reject(
    new Error(`InMemoryTransactionRepository.${method}() is not implemented yet`),
  );
}

function seed(): Transaction[] {
  const now = new Date();
  const entry = (
    id: string,
    type: TransactionType,
    amountMinor: number,
    categoryId: CategoryId,
    description: string,
    day: number,
  ): Transaction => ({
    id,
    type,
    amount: Money.ofMinor(amountMinor, 'EUR'),
    categoryId,
    description,
    occurredAt: new Date(now.getFullYear(), now.getMonth(), day),
    householdId: 'home',
    payerId: IN_MEMORY_USER_ID,
    shared: false,
    shares: [],
  });

  return [
    entry('1', 'income', 245_000, 'salary', 'Nómina', 1),
    entry('2', 'expense', 85_000, 'housing', 'Alquiler', 2),
    entry('3', 'expense', 9_435, 'food', 'Supermercado', 4),
    entry('4', 'expense', 32_000, 'loans', 'Letra del coche', 5),
    entry('5', 'expense', 6_890, 'bills', 'Luz', 6),
    entry('6', 'expense', 4_500, 'insurance', 'Seguro hogar', 8),
  ];
}
