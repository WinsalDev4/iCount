import { Money } from '@/core/domain/Money';

import type { CategoryId, Transaction, TransactionType, YearMonth } from '../domain/Transaction';
import type { TransactionRepository } from '../domain/TransactionRepository';

/**
 * Temporary data source until the backend exists. Swapping it for an
 * `ApiTransactionRepository` only touches the composition root (core/di).
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
