import type { HouseholdId, UserId } from '@/core/domain/Ids';
import type { CurrencyCode, Money } from '@/core/domain/Money';

import type { SplitRule } from './SplitRule';

/** `personal`: just me. `shared`: a couple, family or flat sharing expenses. */
export type HouseholdKind = 'personal' | 'shared';
export type MemberRole = 'admin' | 'member';

export interface Member {
  readonly userId: UserId;
  readonly email: string;
  readonly displayName: string | null;
  readonly role: MemberRole;
  /** Declared monthly income; used by the income-proportional split rule. */
  readonly monthlyIncome: Money | null;
}

export interface Household {
  readonly id: HouseholdId;
  readonly name: string;
  readonly kind: HouseholdKind;
  readonly currency: CurrencyCode;
  readonly splitRule: SplitRule;
  readonly members: readonly Member[];
}

/** Code to share so someone can join (8 characters, 48 h, single use). */
export interface Invitation {
  readonly code: string;
  readonly expiresAt: Date;
}
