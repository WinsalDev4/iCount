import { type SuggestedTransfer, suggestTransfers } from '@icount/finance';

import type { Clock } from '../../../shared/application/clock.js';
import type { IdGenerator } from '../../../shared/application/id-generator.js';
import type { TransactionRunner } from '../../../shared/application/transaction-runner.js';
import type { ActivityLog } from '../../activity/domain/activity.js';
import type { HouseholdAccess } from '../../households/application/household-access.js';
import {
  type BalancePeriod,
  InvalidSettlementError,
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
    const totals = await this.settlements.memberTotals(householdId, period);
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
      householdId,
      currency: household.currency,
      members,
      suggestedTransfers: suggestTransfers(
        members.map(({ memberId, netMinor }) => ({ memberId, netMinor })),
      ),
      pendingApprovalCount: totals.pendingApprovalCount,
    };
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
