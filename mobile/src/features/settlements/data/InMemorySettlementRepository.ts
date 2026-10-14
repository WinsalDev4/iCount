import type { InMemoryHouseholdLedger } from '@/features/household/data/InMemoryHouseholdLedger';

import { computeBalance } from '../domain/balance';
import { SettlementError } from '../domain/SettlementError';
import type {
  BalancePeriod,
  HouseholdBalance,
  NewSettlement,
  Settlement,
} from '../domain/Settlement';
import type { SettlementRepository } from '../domain/SettlementRepository';

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

function toSettlement(record: Settlement): Settlement {
  return {
    id: record.id,
    from: record.from,
    to: record.to,
    amount: record.amount,
    method: record.method,
    note: record.note,
    settledOn: record.settledOn,
  };
}

/**
 * Development/test adapter (`EXPO_PUBLIC_DATA_SOURCE=memory`). The balance is computed on every
 * read from the APPROVED shared movements and the settlements, with the same rules as the API
 * (ADR-0016): nets in whole cents that add up to zero, greedy transfers from `@icount/finance`.
 */
export class InMemorySettlementRepository implements SettlementRepository {
  constructor(private readonly ledger: InMemoryHouseholdLedger) {}

  async balance(householdId: string, period: BalancePeriod = {}): Promise<HouseholdBalance> {
    const household = await this.ledger.household(householdId);
    if (!household) throw new SettlementError('forbidden');

    const all = await this.ledger.sharedTransactions(householdId);
    const from = period.from ? startOfDay(period.from) : null;
    const to = period.to ? startOfDay(period.to) : null;
    const inPeriod = (date: Date) => (!from || date >= from) && (!to || date <= to);

    let pending = 0;
    const counted = all.filter((tx) => {
      const status = this.ledger.approvalOf(tx, household)?.status ?? 'approved';
      if (status === 'pending') pending += 1;
      return status === 'approved' && inPeriod(tx.occurredAt);
    });
    const settlements = this.ledger.settlementsOf(householdId).filter((s) => inPeriod(s.settledOn));

    return computeBalance({
      members: household.members,
      rule: household.splitRule,
      currency: household.currency,
      transactions: counted,
      settlements,
      pendingApprovalCount: pending,
    });
  }

  async list(householdId: string): Promise<readonly Settlement[]> {
    return [...this.ledger.settlementsOf(householdId)]
      .sort(
        (a, b) =>
          b.settledOn.getTime() - a.settledOn.getTime() ||
          b.createdAt.getTime() - a.createdAt.getTime(),
      )
      .map(toSettlement);
  }

  async create(input: NewSettlement): Promise<Settlement> {
    const household = await this.ledger.household(input.householdId);
    if (!household) throw new SettlementError('forbidden');
    const ids = new Set(household.members.map((m) => m.userId as string));
    if (!ids.has(input.from) || !ids.has(input.to)) throw new SettlementError('invalid');
    return toSettlement(
      this.ledger.addSettlement({ ...input, settledOn: startOfDay(input.settledOn) }),
    );
  }
}
