import type { CurrencyCode } from '@icount/contracts';

import {
  AlreadyMemberError,
  CurrencyMismatchError,
  HouseholdNotFoundError,
  InvalidSplitRuleError,
  NotHouseholdAdminError,
  PersonalHouseholdError,
} from './households.errors.js';

// Value types shared with the app come from the contracts (the ubiquitous language);
// the domain only imports *types* from there, never schemas or runtime code.
export type HouseholdKind = 'personal' | 'shared';
export type MemberRole = 'admin' | 'member';

export const FULL_SHARE_BASIS_POINTS = 10_000;

export interface MemberShare {
  readonly memberId: string;
  readonly basisPoints: number;
}

export type SplitRule =
  | { readonly type: 'equal' }
  | { readonly type: 'income-proportional' }
  | {
      readonly type: 'custom';
      readonly categories: readonly {
        readonly categoryId: string;
        readonly shares: readonly MemberShare[];
      }[];
    };

export interface Member {
  readonly userId: string;
  readonly email: string;
  readonly displayName: string | null;
  readonly role: MemberRole;
  readonly monthlyIncomeMinor: number | null;
  readonly joinedAt: Date;
}

export interface UserSummary {
  readonly userId: string;
  readonly email: string;
  readonly displayName: string | null;
}

/**
 * Aggregate root: every rule about who belongs to a household and how it splits
 * money lives here, so no use case can bypass them.
 */
export class Household {
  private constructor(
    readonly id: string,
    readonly name: string,
    readonly kind: HouseholdKind,
    readonly currency: CurrencyCode,
    private rule: SplitRule,
    private readonly memberList: Member[],
    readonly createdAt: Date,
  ) {}

  static create(props: {
    id: string;
    name: string;
    kind: HouseholdKind;
    currency: CurrencyCode;
    creator: UserSummary;
    now: Date;
  }): Household {
    const admin: Member = {
      ...props.creator,
      role: 'admin',
      monthlyIncomeMinor: null,
      joinedAt: props.now,
    };
    return new Household(
      props.id,
      props.name,
      props.kind,
      props.currency,
      { type: 'equal' },
      [admin],
      props.now,
    );
  }

  static restore(props: {
    id: string;
    name: string;
    kind: HouseholdKind;
    currency: CurrencyCode;
    splitRule: SplitRule;
    members: Member[];
    createdAt: Date;
  }): Household {
    return new Household(
      props.id,
      props.name,
      props.kind,
      props.currency,
      props.splitRule,
      [...props.members],
      props.createdAt,
    );
  }

  get splitRule(): SplitRule {
    return this.rule;
  }

  get members(): readonly Member[] {
    return this.memberList;
  }

  isMember(userId: string): boolean {
    return this.memberList.some((member) => member.userId === userId);
  }

  assertCanManage(userId: string): void {
    const member = this.memberList.find((m) => m.userId === userId);
    if (member?.role !== 'admin') throw new NotHouseholdAdminError();
  }

  /** Invitations only make sense for shared households. */
  assertAcceptsMembers(): void {
    if (this.kind === 'personal') throw new PersonalHouseholdError();
  }

  addMember(user: UserSummary, now: Date): void {
    this.assertAcceptsMembers();
    if (this.isMember(user.userId)) throw new AlreadyMemberError();
    this.memberList.push({ ...user, role: 'member', monthlyIncomeMinor: null, joinedAt: now });
  }

  setSplitRule(actorId: string, rule: SplitRule): void {
    this.assertCanManage(actorId);
    if (rule.type === 'custom') this.assertValidCustomRule(rule);
    this.rule = rule;
  }

  setMemberIncome(userId: string, amountMinor: number, currency: CurrencyCode): void {
    if (currency !== this.currency) throw new CurrencyMismatchError(this.currency, currency);
    if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) {
      // The contract already rejects these: reaching here is a programming error.
      throw new RangeError('Income must be a non-negative safe integer of cents');
    }
    const index = this.memberList.findIndex((m) => m.userId === userId);
    const member = this.memberList[index];
    if (!member) throw new HouseholdNotFoundError(this.id);
    this.memberList[index] = { ...member, monthlyIncomeMinor: amountMinor };
  }

  private assertValidCustomRule(rule: Extract<SplitRule, { type: 'custom' }>): void {
    const categories = new Set<string>();
    for (const { categoryId, shares } of rule.categories) {
      if (categories.has(categoryId)) {
        throw new InvalidSplitRuleError(`Category ${categoryId} appears twice.`);
      }
      categories.add(categoryId);

      const total = shares.reduce((sum, share) => sum + share.basisPoints, 0);
      const members = new Set(shares.map((share) => share.memberId));
      if (total !== FULL_SHARE_BASIS_POINTS || members.size !== shares.length) {
        throw new InvalidSplitRuleError(
          `Shares of ${categoryId} must add up to 100 % with each member once.`,
        );
      }
      const outsider = shares.find((share) => !this.isMember(share.memberId));
      if (outsider) {
        throw new InvalidSplitRuleError(`${outsider.memberId} is not a member of this household.`);
      }
    }
  }
}

export abstract class HouseholdRepository {
  abstract findById(id: string): Promise<Household | null>;
  /** Households the user belongs to, oldest first. */
  abstract findForMember(userId: string): Promise<Household[]>;
  /** Inserts or updates the household and its members. */
  abstract save(household: Household): Promise<void>;
}
