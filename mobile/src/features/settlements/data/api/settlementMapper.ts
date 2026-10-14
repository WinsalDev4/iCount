import type { HouseholdBalanceDto, MoneyDto, SettlementDto } from '@icount/contracts';

import type { UserId } from '@/core/domain/Ids';
import { Money } from '@/core/domain/Money';

import { fromLocalDate, toLocalDate } from '../../../transactions/data/api/transactionMapper';
import type { HouseholdBalance, NewSettlement, Settlement } from '../../domain/Settlement';

const toMoney = (money: MoneyDto) => Money.ofMinor(money.amountMinor, money.currency);
const asUserId = (id: string) => id as UserId;

export function toHouseholdBalance(dto: HouseholdBalanceDto): HouseholdBalance {
  return {
    members: dto.members.map((member) => ({
      memberId: asUserId(member.memberId),
      paid: toMoney(member.paid),
      owed: toMoney(member.owed),
      net: toMoney(member.net),
    })),
    suggestedTransfers: dto.suggestedTransfers.map((transfer) => ({
      from: asUserId(transfer.fromMemberId),
      to: asUserId(transfer.toMemberId),
      amount: toMoney(transfer.amount),
    })),
    pendingApprovalCount: dto.pendingApprovalCount,
  };
}

export function toSettlement(dto: SettlementDto): Settlement {
  return {
    id: dto.id,
    from: asUserId(dto.fromMemberId),
    to: asUserId(dto.toMemberId),
    amount: toMoney(dto.amount),
    method: dto.method,
    note: dto.note,
    settledOn: fromLocalDate(dto.settledOn),
  };
}

/** Request body for POST …/settlements. */
export function toCreateSettlementRequest(input: NewSettlement) {
  return {
    fromMemberId: input.from,
    toMemberId: input.to,
    amount: { amountMinor: input.amount.amountMinor, currency: input.amount.currency },
    method: input.method,
    note: input.note,
    settledOn: toLocalDate(input.settledOn),
  };
}
