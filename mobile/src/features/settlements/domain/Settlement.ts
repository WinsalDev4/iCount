import type { UserId } from '@/core/domain/Ids';
import type { Money } from '@/core/domain/Money';

/** `net = paid − owed`. Positive: the others owe this member. Nets add up to zero. */
export interface MemberBalance {
  readonly memberId: UserId;
  readonly paid: Money;
  readonly owed: Money;
  readonly net: Money;
}

export interface Transfer {
  readonly from: UserId;
  readonly to: UserId;
  readonly amount: Money;
}

export interface HouseholdBalance {
  readonly members: readonly MemberBalance[];
  /** Fewest transfers that settle everything (ADR-0016). */
  readonly suggestedTransfers: readonly Transfer[];
  /** Shared movements still pending approval (not counted in the nets). */
  readonly pendingApprovalCount: number;
}

export type SettlementMethod = 'bizum' | 'bank-transfer' | 'cash' | 'other';

export interface Settlement {
  readonly id: string;
  readonly from: UserId;
  readonly to: UserId;
  readonly amount: Money;
  readonly method: SettlementMethod;
  readonly note: string;
  /** Local midnight of the day it was paid. */
  readonly settledOn: Date;
}

export interface NewSettlement {
  readonly householdId: string;
  readonly from: UserId;
  readonly to: UserId;
  readonly amount: Money;
  readonly method: SettlementMethod;
  readonly note: string;
  readonly settledOn: Date;
}

/** Optional day range for the balance; omitted = all time. */
export interface BalancePeriod {
  readonly from?: Date;
  readonly to?: Date;
}
