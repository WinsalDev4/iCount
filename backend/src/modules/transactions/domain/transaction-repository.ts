import type { Transaction, TransactionType } from './transaction.js';

export interface TransactionFilters {
  readonly type?: TransactionType;
  readonly categoryId?: string;
  /** Payer or one of the members with a share. */
  readonly memberId?: string;
  readonly shared?: boolean;
  /** Inclusive `YYYY-MM-DD` range. */
  readonly from?: string;
  readonly to?: string;
  /** Free text over the description (case-insensitive). */
  readonly query?: string;
}

/** Keyset position: the last item of the previous page. */
export interface ListCursor {
  readonly occurredOn: string;
  readonly createdAt: Date;
  readonly id: string;
}

export interface TransactionPage {
  readonly items: Transaction[];
  /** Position of the last item when there are more, otherwise null. */
  readonly next: ListCursor | null;
}

export interface MonthTotals {
  readonly incomeMinor: number;
  readonly expensesMinor: number;
  /** Largest first. */
  readonly expensesByCategory: readonly { categoryId: string; amountMinor: number }[];
}

export interface DayTotals {
  readonly date: string;
  readonly incomeMinor: number;
  readonly expensesMinor: number;
}

export abstract class TransactionRepository {
  abstract findById(id: string): Promise<Transaction | null>;
  /** Inserts or updates the movement and replaces its shares. */
  abstract save(transaction: Transaction): Promise<void>;
  abstract delete(id: string): Promise<void>;
  /** Newest first: (occurredOn, createdAt, id) descending. */
  abstract list(
    householdId: string,
    filters: TransactionFilters,
    after: ListCursor | null,
    limit: number,
  ): Promise<TransactionPage>;
  abstract totals(householdId: string, from: string, to: string): Promise<MonthTotals>;
  abstract dailyTotals(householdId: string, from: string, to: string): Promise<DayTotals[]>;
}
