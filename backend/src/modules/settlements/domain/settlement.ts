import { DomainError } from '../../../shared/domain/domain-error.js';
import type { Household } from '../../households/domain/household.js';

export type SettlementMethod = 'bizum' | 'bank-transfer' | 'cash' | 'other';

export interface SettlementProps {
  readonly id: string;
  readonly householdId: string;
  readonly fromMemberId: string;
  readonly toMemberId: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly method: SettlementMethod;
  readonly note: string;
  /** Calendar day it was paid. */
  readonly settledOn: string;
  readonly createdBy: string;
  readonly createdAt: Date;
}

/**
 * A payment between two members that settles (part of) their balance. It is
 * not an expense: it counts in balances at once (no approval) and never in
 * budgets or the monthly summary (ADR-0016).
 */
export class Settlement {
  private constructor(readonly snapshot: SettlementProps) {}

  static create(household: Household, props: SettlementProps): Settlement {
    const { fromMemberId, toMemberId, amountMinor, currency, note } = props;
    if (fromMemberId === toMemberId) {
      throw new InvalidSettlementError('A member cannot pay themselves.');
    }
    if (!household.isMember(fromMemberId) || !household.isMember(toMemberId)) {
      throw new InvalidSettlementError('Both people must be members of the household.');
    }
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
      throw new InvalidSettlementError('The amount must be a positive number of cents.');
    }
    if (currency !== household.currency) {
      throw new InvalidSettlementError(
        `This household uses ${household.currency}, not ${currency}.`,
      );
    }
    if (note.length > 140) {
      throw new InvalidSettlementError('The note is limited to 140 characters.');
    }
    return new Settlement({ ...props, householdId: household.id });
  }

  static restore(props: SettlementProps): Settlement {
    return new Settlement(props);
  }

  get id(): string {
    return this.snapshot.id;
  }
}

/** What each member has paid and owes over the counted movements and settlements. */
export interface MemberTotals {
  /** Shared expenses paid (minus shared income received) + settlements sent. */
  readonly paid: ReadonlyMap<string, number>;
  /** Their shares of those movements + settlements received. */
  readonly owed: ReadonlyMap<string, number>;
  /** Shared movements still waiting for approval (not counted). */
  readonly pendingApprovalCount: number;
}

/** Optional inclusive range of days; omitted = all time. */
export interface BalancePeriod {
  readonly from?: string;
  readonly to?: string;
}

export abstract class SettlementRepository {
  abstract save(settlement: Settlement): Promise<void>;
  /** Newest first. */
  abstract listForHousehold(householdId: string): Promise<Settlement[]>;
  abstract memberTotals(householdId: string, period: BalancePeriod): Promise<MemberTotals>;
  /** Households where balances make sense (for the weekly reminder). */
  abstract sharedHouseholdIds(): Promise<string[]>;
}

export class InvalidSettlementError extends DomainError {
  readonly kind = 'invalid';
  readonly code = 'invalid-settlement';
  readonly title = 'Invalid settlement';
}
