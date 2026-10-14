import { currentMemoryIdentity } from '@/features/auth/data/memoryIdentity';
import { sharedMemoryTransactionRepository } from '@/features/transactions/data/sharedMemoryRepository';

import { InMemoryHouseholdLedger } from './InMemoryHouseholdLedger';
import { InMemoryHouseholdRepository } from './InMemoryHouseholdRepository';

/**
 * ONE in-memory household repository and ONE ledger per app run, shared by the household,
 * activity and settlements modules (see sharedMemoryRepository in transactions for the reason).
 * With the real API this file is never used.
 */
let households: InMemoryHouseholdRepository | undefined;
let ledger: InMemoryHouseholdLedger | undefined;

export function sharedMemoryHouseholdRepository(): InMemoryHouseholdRepository {
  households ??= new InMemoryHouseholdRepository();
  return households;
}

export function sharedMemoryHouseholdLedger(): InMemoryHouseholdLedger {
  ledger ??= new InMemoryHouseholdLedger({
    transactions: sharedMemoryTransactionRepository(),
    households: sharedMemoryHouseholdRepository(),
    me: () => currentMemoryIdentity().userId,
  });
  return ledger;
}

/** Starts from scratch: tests. */
export function resetSharedMemoryHousehold(): void {
  households = undefined;
  ledger = undefined;
}
