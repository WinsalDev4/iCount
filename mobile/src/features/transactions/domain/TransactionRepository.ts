import type { Page, PageRequest } from '@/core/domain/Page';

import type { MonthlySummary } from './MonthlySummary';
import type {
  DailyTotal,
  NewTransaction,
  Transaction,
  TransactionChanges,
  TransactionFilters,
  YearMonth,
} from './Transaction';

/**
 * Port (Dependency Inversion): the domain declares what it needs and the data
 * layer provides the implementation (in-memory today, REST API tomorrow).
 * Failures reject with `TransactionError`. Use cases should depend on the
 * smallest slice they need, e.g. `Pick<TransactionRepository, 'findByMonth'>`.
 */
export interface TransactionRepository {
  findByMonth(householdId: string, period: YearMonth): Promise<Transaction[]>;
  /** Newest first, paginated with an opaque cursor. */
  list(
    householdId: string,
    filters: TransactionFilters,
    page: PageRequest,
  ): Promise<Page<Transaction>>;
  getById(id: string): Promise<Transaction | null>;
  create(input: NewTransaction): Promise<Transaction>;
  update(id: string, changes: TransactionChanges): Promise<Transaction>;
  delete(id: string): Promise<void>;
  monthlySummary(householdId: string, period: YearMonth): Promise<MonthlySummary>;
  /** One entry per day with movements in that month. */
  dailyTotals(householdId: string, period: YearMonth): Promise<readonly DailyTotal[]>;
}
