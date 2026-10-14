import type { CurrencyCode } from '@icount/contracts';

import type { Clock } from '../../../shared/application/clock.js';
import type { IdGenerator } from '../../../shared/application/id-generator.js';
import type { TransactionRunner } from '../../../shared/application/transaction-runner.js';
import type { ActivityLog } from '../../activity/domain/activity.js';
import type { UserRepository } from '../../auth/domain/user.js';
import {
  Household,
  type HouseholdKind,
  type HouseholdRepository,
  type SplitRule,
  type UserSummary,
} from '../domain/household.js';
import {
  AlreadyMemberError,
  ExpiredInviteError,
  HouseholdNotFoundError,
  InvalidInviteError,
} from '../domain/households.errors.js';
import type { Invitation, InvitationRepository } from '../domain/invitation.js';

const HOUR_MS = 60 * 60 * 1000;
export const INVITATION_TTL_HOURS = 48;

/** Generates human-friendly invite codes (8 characters without look-alikes). */
export abstract class InviteCodeGenerator {
  abstract generate(): string;
}

/** Loads a household only for its members: for anyone else it "does not exist". */
async function loadForMember(
  households: HouseholdRepository,
  householdId: string,
  userId: string,
): Promise<Household> {
  const household = await households.findById(householdId);
  if (!household?.isMember(userId)) throw new HouseholdNotFoundError(householdId);
  return household;
}

async function summaryOf(users: UserRepository, userId: string): Promise<UserSummary> {
  const user = await users.findById(userId);
  if (!user) throw new Error(`Authenticated user ${userId} does not exist`);
  return { userId: user.id, email: user.email, displayName: user.displayName };
}

export class CreateHousehold {
  constructor(
    private readonly households: HouseholdRepository,
    private readonly users: UserRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(
    actorId: string,
    input: { name: string; kind: HouseholdKind; currency: CurrencyCode },
  ): Promise<Household> {
    const household = Household.create({
      id: this.ids.next(),
      ...input,
      creator: await summaryOf(this.users, actorId),
      now: this.clock.now(),
    });
    await this.households.save(household);
    return household;
  }
}

export class ListMyHouseholds {
  constructor(private readonly households: HouseholdRepository) {}

  execute(actorId: string): Promise<Household[]> {
    return this.households.findForMember(actorId);
  }
}

export class GetHousehold {
  constructor(private readonly households: HouseholdRepository) {}

  execute(actorId: string, householdId: string): Promise<Household> {
    return loadForMember(this.households, householdId, actorId);
  }
}

export class CreateInvitation {
  private static readonly MAX_ATTEMPTS = 5;

  constructor(
    private readonly households: HouseholdRepository,
    private readonly invitations: InvitationRepository,
    private readonly codes: InviteCodeGenerator,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(actorId: string, householdId: string): Promise<Invitation> {
    const household = await loadForMember(this.households, householdId, actorId);
    household.assertCanManage(actorId);
    household.assertAcceptsMembers();

    const now = this.clock.now();
    // 30^8 ≈ 6.5·10^11 codes: a collision is very unlikely, but cheap to handle.
    for (let attempt = 0; attempt < CreateInvitation.MAX_ATTEMPTS; attempt++) {
      const invitation: Invitation = {
        id: this.ids.next(),
        householdId,
        code: this.codes.generate(),
        createdBy: actorId,
        expiresAt: new Date(now.getTime() + INVITATION_TTL_HOURS * HOUR_MS),
        usedAt: null,
        createdAt: now,
      };
      if (await this.invitations.create(invitation)) return invitation;
    }
    throw new Error('Could not generate a unique invite code');
  }
}

export class JoinHousehold {
  constructor(
    private readonly households: HouseholdRepository,
    private readonly invitations: InvitationRepository,
    private readonly users: UserRepository,
    private readonly transactions: TransactionRunner,
    private readonly clock: Clock,
    private readonly log: ActivityLog,
  ) {}

  /** Using the code and becoming a member happen together or not at all. */
  execute(actorId: string, code: string): Promise<Household> {
    return this.transactions.run(async () => {
      const now = this.clock.now();
      const invitation = await this.invitations.findByCode(code);
      if (!invitation || invitation.usedAt) throw new InvalidInviteError();
      if (invitation.expiresAt <= now) throw new ExpiredInviteError();

      const household = await this.households.findById(invitation.householdId);
      if (!household) throw new InvalidInviteError();
      if (household.isMember(actorId)) throw new AlreadyMemberError();

      household.addMember(await summaryOf(this.users, actorId), now);
      if (!(await this.invitations.markUsed(invitation.id, actorId, now))) {
        throw new InvalidInviteError();
      }
      await this.households.save(household);
      await this.log.record({ householdId: household.id, type: 'member-joined', actorId });
      return household;
    });
  }
}

export class SetSplitRule {
  constructor(private readonly households: HouseholdRepository) {}

  async execute(actorId: string, householdId: string, rule: SplitRule): Promise<Household> {
    const household = await loadForMember(this.households, householdId, actorId);
    household.setSplitRule(actorId, rule);
    await this.households.save(household);
    return household;
  }
}

export class SetMyIncome {
  constructor(private readonly households: HouseholdRepository) {}

  async execute(
    actorId: string,
    householdId: string,
    income: { amountMinor: number; currency: CurrencyCode },
  ): Promise<Household> {
    const household = await loadForMember(this.households, householdId, actorId);
    household.setMemberIncome(actorId, income.amountMinor, income.currency);
    await this.households.save(household);
    return household;
  }
}
