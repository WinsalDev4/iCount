import { type SuggestedTransfer, suggestTransfers } from '@icount/finance';

import type { Clock } from '../../../shared/application/clock.js';
import type { IdGenerator } from '../../../shared/application/id-generator.js';
import type { TransactionRunner } from '../../../shared/application/transaction-runner.js';
import type { ActivityLog } from '../../activity/domain/activity.js';
import type { HouseholdAccess } from '../../households/application/household-access.js';
import type { Household, HouseholdRepository } from '../../households/domain/household.js';
import type { PushNotifications } from '../../push/domain/push.js';
import {
  type BalancePeriod,
  InvalidSettlementError,
  type MemberTotals,
  Settlement,
  type SettlementMethod,
  type SettlementRepository,
} from '../domain/settlement.js';

export interface MemberBalance {
  readonly memberId: string;
  readonly paidMinor: number;
  readonly owedMinor: number;
  readonly netMinor: number;
}

export interface HouseholdBalance {
  readonly householdId: string;
  readonly currency: string;
  readonly members: MemberBalance[];
  readonly suggestedTransfers: SuggestedTransfer[];
  readonly pendingApprovalCount: number;
}

/**
 * `net = paid − owed` per member (ADR-0016) and the transfers that settle it.
 * Former members with movements still appear: otherwise the nets would not add
 * up to zero.
 */
export function balanceOf(household: Household, totals: MemberTotals): HouseholdBalance {
  const memberIds = [
    ...new Set([
      ...household.members.map((member) => member.userId),
      ...totals.paid.keys(),
      ...totals.owed.keys(),
    ]),
  ];
  const members = memberIds.map((memberId) => {
    const paidMinor = totals.paid.get(memberId) ?? 0;
    const owedMinor = totals.owed.get(memberId) ?? 0;
    return { memberId, paidMinor, owedMinor, netMinor: paidMinor - owedMinor };
  });
  return {
    householdId: household.id,
    currency: household.currency,
    members,
    suggestedTransfers: suggestTransfers(
      members.map(({ memberId, netMinor }) => ({ memberId, netMinor })),
    ),
    pendingApprovalCount: totals.pendingApprovalCount,
  };
}

export class GetBalance {
  constructor(
    private readonly access: HouseholdAccess,
    private readonly settlements: SettlementRepository,
  ) {}

  async execute(
    actorId: string,
    householdId: string,
    period: BalancePeriod,
  ): Promise<HouseholdBalance> {
    const household = await this.access.requireMember(householdId, actorId);
    if (period.from && period.to && period.from > period.to) {
      throw new InvalidSettlementError('`from` must not be after `to`.');
    }
    return balanceOf(household, await this.settlements.memberTotals(householdId, period));
  }
}

export class ListSettlements {
  constructor(
    private readonly access: HouseholdAccess,
    private readonly settlements: SettlementRepository,
  ) {}

  async execute(actorId: string, householdId: string): Promise<Settlement[]> {
    await this.access.requireMember(householdId, actorId);
    return this.settlements.listForHousehold(householdId);
  }
}

export class CreateSettlement {
  constructor(
    private readonly access: HouseholdAccess,
    private readonly settlements: SettlementRepository,
    private readonly log: ActivityLog,
    private readonly runner: TransactionRunner,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  execute(
    actorId: string,
    householdId: string,
    input: {
      fromMemberId: string;
      toMemberId: string;
      amountMinor: number;
      currency: string;
      method: SettlementMethod;
      note: string;
      settledOn: string;
    },
  ): Promise<Settlement> {
    return this.runner.run(async () => {
      const household = await this.access.requireMember(householdId, actorId);
      const settlement = Settlement.create(household, {
        ...input,
        id: this.ids.next(),
        householdId,
        createdBy: actorId,
        createdAt: this.clock.now(),
      });
      await this.settlements.save(settlement);
      await this.log.record({
        householdId,
        type: 'settlement-created',
        actorId,
        settlementId: settlement.id,
        amountMinor: input.amountMinor,
        currency: input.currency,
        description: input.note || undefined,
      });
      return settlement;
    });
  }
}

/** Debts below this are not worth a reminder (10 €). */
export const SETTLE_REMINDER_THRESHOLD_MINOR = 1_000;

/**
 * Weekly job (ADR-0017): reminds every member who owes more than the threshold
 * in a shared household. No amounts in the text: the lock screen is public.
 */
export class SendSettleReminders {
  constructor(
    private readonly households: HouseholdRepository,
    private readonly settlements: SettlementRepository,
    private readonly push: PushNotifications,
  ) {}

  async execute(): Promise<{ reminded: number }> {
    let reminded = 0;
    for (const householdId of await this.settlements.sharedHouseholdIds()) {
      const household = await this.households.findById(householdId);
      if (!household) continue;
      const balance = balanceOf(household, await this.settlements.memberTotals(householdId, {}));
      const debtors = balance.members
        .filter((member) => member.netMinor <= -SETTLE_REMINDER_THRESHOLD_MINOR)
        .map((member) => member.memberId)
        .filter((memberId) => household.isMember(memberId));
      if (debtors.length === 0) continue;
      this.push.notify({
        recipients: debtors,
        event: 'settle-reminder',
        title: `Toca saldar cuentas en ${household.name}`,
        body: 'Tienes pagos pendientes con el hogar. Ábrelo para ver a quién y cuánto.',
        url: '/settle',
      });
      reminded += debtors.length;
    }
    return { reminded };
  }
}
