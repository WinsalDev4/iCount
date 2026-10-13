import type { BalancePeriod, HouseholdBalance, NewSettlement, Settlement } from './Settlement';

/**
 * Port for balances and settlements. Implementations: InMemory (B-5.1) and
 * ApiSettlementRepository (A-5.1). Failures reject with `SettlementError`.
 */
export interface SettlementRepository {
  balance(householdId: string, period?: BalancePeriod): Promise<HouseholdBalance>;
  /** Newest first. */
  list(householdId: string): Promise<readonly Settlement[]>;
  create(input: NewSettlement): Promise<Settlement>;
}
