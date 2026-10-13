import type { HouseholdId } from '@/core/domain/Ids';
import type { CurrencyCode, Money } from '@/core/domain/Money';

import type { Household, HouseholdKind, Invitation } from './Household';
import type { SplitRule } from './SplitRule';

export interface CreateHouseholdInput {
  readonly name: string;
  readonly kind: HouseholdKind;
  readonly currency: CurrencyCode;
}

/**
 * Port for households. Implementations: InMemoryHouseholdRepository (B-2.3) and
 * ApiHouseholdRepository (A-2.3). Failures reject with `HouseholdError`.
 */
export interface HouseholdRepository {
  /** Households the signed-in user belongs to. */
  getMine(): Promise<readonly Household[]>;
  /** The creator becomes admin. */
  create(input: CreateHouseholdInput): Promise<Household>;
  createInvite(householdId: HouseholdId): Promise<Invitation>;
  /** `code` as typed by the user; implementations normalise it. */
  join(code: string): Promise<Household>;
  /** Admin only. */
  setSplitRule(householdId: HouseholdId, rule: SplitRule): Promise<Household>;
  /** The signed-in member's declared monthly income. */
  setMyIncome(householdId: HouseholdId, monthlyIncome: Money): Promise<Household>;
}
