import type { Transaction, YearMonth } from './Transaction';

/**
 * Port (Dependency Inversion): the domain declares what it needs and the data
 * layer provides the implementation (in-memory today, REST API tomorrow).
 */
export interface TransactionRepository {
  findByMonth(householdId: string, period: YearMonth): Promise<Transaction[]>;
}
