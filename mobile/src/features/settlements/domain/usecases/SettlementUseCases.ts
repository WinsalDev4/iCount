import { SettlementError } from '../SettlementError';
import type { BalancePeriod, HouseholdBalance, NewSettlement, Settlement } from '../Settlement';
import type { SettlementRepository } from '../SettlementRepository';

const MAX_NOTE = 140;

/** Net position of every member and the transfers that would settle the household. */
export class GetBalance {
  constructor(private readonly repository: Pick<SettlementRepository, 'balance'>) {}

  execute(householdId: string, period?: BalancePeriod): Promise<HouseholdBalance> {
    if (period?.from && period.to && period.from > period.to) {
      return Promise.reject(new SettlementError('invalid'));
    }
    return this.repository.balance(householdId, period);
  }
}

export class ListSettlements {
  constructor(private readonly repository: Pick<SettlementRepository, 'list'>) {}

  execute(householdId: string): Promise<readonly Settlement[]> {
    return this.repository.list(householdId);
  }
}

/** Records a payment between two members. Rejects what would make no sense before storing it. */
export class CreateSettlement {
  constructor(private readonly repository: Pick<SettlementRepository, 'create'>) {}

  execute(input: NewSettlement): Promise<Settlement> {
    if (
      input.from === input.to ||
      input.amount.amountMinor <= 0 ||
      input.note.trim().length > MAX_NOTE
    ) {
      return Promise.reject(new SettlementError('invalid'));
    }
    return this.repository.create({ ...input, note: input.note.trim() });
  }
}
