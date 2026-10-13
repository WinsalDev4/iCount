import type { CategoryId } from '@/core/domain/Category';
import type { UserId } from '@/core/domain/Ids';
import type { Money } from '@/core/domain/Money';

export type TransactionType = 'income' | 'expense';

/** Categories live in core/domain because household split rules use them too. */
export type { CategoryId };

/** Part of a shared movement that corresponds to one member. */
export interface MemberShareAmount {
  readonly memberId: UserId;
  readonly amount: Money;
}

export interface Transaction {
  readonly id: string;
  readonly type: TransactionType;
  /** Always positive; the sign is given by `type`. */
  readonly amount: Money;
  readonly categoryId: CategoryId;
  readonly description: string;
  /** Local calendar day (midnight); the time of day is not tracked. */
  readonly occurredAt: Date;
  /** Shared economies (e.g. a couple) group transactions by household. */
  readonly householdId: string;
  /** Member who paid (expense) or received (income) the money. */
  readonly payerId: UserId;
  /** Shared movements are split between members with the household's SplitRule. */
  readonly shared: boolean;
  /** Empty when not shared; otherwise the amounts add up to `amount`. */
  readonly shares: readonly MemberShareAmount[];
}

/** Data to create a movement. Shares are computed by the server from the SplitRule. */
export interface NewTransaction {
  /** Client-generated id (optimistic updates, idempotent retries). */
  readonly id?: string;
  readonly householdId: string;
  readonly type: TransactionType;
  readonly amount: Money;
  readonly categoryId: CategoryId;
  readonly description: string;
  readonly occurredAt: Date;
  /** Defaults to the signed-in member. */
  readonly payerId?: UserId;
  readonly shared: boolean;
}

/** Fields that can change when editing a movement. */
export type TransactionChanges = Partial<Omit<NewTransaction, 'id' | 'householdId'>>;

export interface TransactionFilters {
  readonly type?: TransactionType;
  readonly categoryId?: CategoryId;
  readonly memberId?: UserId;
  readonly shared?: boolean;
  /** Inclusive day range. */
  readonly from?: Date;
  readonly to?: Date;
  /** Free text over the description. */
  readonly query?: string;
}

/** Totals of one calendar day, for the history heat map. */
export interface DailyTotal {
  /** Local midnight of that day. */
  readonly date: Date;
  readonly income: Money;
  readonly expenses: Money;
}

/** Year + 1-based month, e.g. { year: 2026, month: 10 }. */
export interface YearMonth {
  readonly year: number;
  readonly month: number;
}
