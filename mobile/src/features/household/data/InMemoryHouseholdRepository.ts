import type { HouseholdId, UserId } from '@/core/domain/Ids';
import { Money } from '@/core/domain/Money';

import type { Household, Invitation, Member } from '../domain/Household';
import { HouseholdError } from '../domain/HouseholdError';
import type { CreateHouseholdInput, HouseholdRepository } from '../domain/HouseholdRepository';
import { normalizeInviteCode } from '../domain/inviteCode';
import { isValidShares, type SplitRule } from '../domain/SplitRule';

export interface MemoryIdentity {
  readonly userId: UserId;
  readonly email: string;
  readonly displayName: string | null;
}

export interface InMemoryHouseholdOptions {
  /** Who is "me" in this device-only world. */
  readonly me?: MemoryIdentity;
  readonly now?: () => Date;
  /** 8-character code generator; inject a fixed one in tests. */
  readonly randomCode?: () => string;
}

const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const INVITE_TTL_MS = 48 * 60 * 60 * 1000;

/** Codes that trigger each error path when trying the flow by hand without a backend. */
export const MEMORY_EXPIRED_CODE = 'EXPIRED1';
export const MEMORY_UNKNOWN_CODE = 'UNKNOWN1';

/**
 * Development/test adapter (`EXPO_PUBLIC_DATA_SOURCE=memory`): nothing is persisted.
 * Any well-formed code joins a demo household ("Casa Ana & Leo"); `EXPIRED1` and `UNKNOWN1`
 * produce the corresponding errors so every message of the screens can be seen.
 */
export class InMemoryHouseholdRepository implements HouseholdRepository {
  private households: Household[] = [];
  private readonly invites = new Map<string, HouseholdId>();
  private sequence = 0;
  private readonly me: MemoryIdentity;
  private readonly now: () => Date;
  private readonly randomCode: () => string;

  constructor({ me, now, randomCode }: InMemoryHouseholdOptions = {}) {
    this.me = me ?? { userId: 'user-me' as UserId, email: 'tu@icount.app', displayName: null };
    this.now = now ?? (() => new Date());
    this.randomCode = randomCode ?? defaultRandomCode;
  }

  async getMine(): Promise<readonly Household[]> {
    return [...this.households];
  }

  async create(input: CreateHouseholdInput): Promise<Household> {
    const household: Household = {
      id: this.nextId(),
      name: input.name,
      kind: input.kind,
      currency: input.currency,
      splitRule: { kind: 'equal' },
      members: [this.myMember('admin')],
    };
    this.households = [...this.households, household];
    return household;
  }

  async createInvite(householdId: HouseholdId): Promise<Invitation> {
    this.require(householdId);
    const code = this.randomCode();
    this.invites.set(code, householdId);
    return { code, expiresAt: new Date(this.now().getTime() + INVITE_TTL_MS) };
  }

  async join(rawCode: string): Promise<Household> {
    const code = normalizeInviteCode(rawCode);
    if (code === MEMORY_EXPIRED_CODE) throw new HouseholdError('expired-invite');
    if (code === MEMORY_UNKNOWN_CODE) throw new HouseholdError('invalid-invite');

    const own = this.invites.get(code);
    if (own) throw new HouseholdError('already-member');

    const joined: Household = {
      id: this.nextId(),
      name: 'Casa Ana & Leo',
      kind: 'shared',
      currency: 'EUR',
      splitRule: { kind: 'equal' },
      members: [
        {
          userId: 'user-ana' as UserId,
          email: 'ana@casa.app',
          displayName: 'Ana',
          role: 'admin',
          monthlyIncome: Money.ofMinor(200_000, 'EUR'),
        },
        this.myMember('member'),
      ],
    };
    this.households = [...this.households, joined];
    return joined;
  }

  async setSplitRule(householdId: HouseholdId, rule: SplitRule): Promise<Household> {
    const household = this.require(householdId);
    const me = household.members.find((member) => member.userId === this.me.userId);
    if (me?.role !== 'admin') throw new HouseholdError('forbidden');

    if (rule.kind === 'custom') {
      const ids = new Set(household.members.map((member) => member.userId as string));
      const valid = rule.categories.every(
        (category) =>
          isValidShares(category.shares) &&
          category.shares.length === ids.size &&
          category.shares.every((share) => ids.has(share.memberId)),
      );
      if (!valid) throw new HouseholdError('invalid-split-rule');
    }
    return this.replace({ ...household, splitRule: rule });
  }

  async setMyIncome(householdId: HouseholdId, monthlyIncome: Money): Promise<Household> {
    const household = this.require(householdId);
    const members = household.members.map((member) =>
      member.userId === this.me.userId ? { ...member, monthlyIncome } : member,
    );
    return this.replace({ ...household, members });
  }

  private myMember(role: Member['role']): Member {
    return {
      userId: this.me.userId,
      email: this.me.email,
      displayName: this.me.displayName,
      role,
      monthlyIncome: null,
    };
  }

  private require(householdId: HouseholdId): Household {
    const household = this.households.find((h) => h.id === householdId);
    if (!household) throw new HouseholdError('not-found');
    return household;
  }

  private replace(updated: Household): Household {
    this.households = this.households.map((h) => (h.id === updated.id ? updated : h));
    return updated;
  }

  private nextId(): HouseholdId {
    this.sequence += 1;
    return `household-${this.sequence}` as HouseholdId;
  }
}

function defaultRandomCode(): string {
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += INVITE_ALPHABET[Math.floor(Math.random() * INVITE_ALPHABET.length)];
  }
  return code;
}
