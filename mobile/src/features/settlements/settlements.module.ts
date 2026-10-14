import type { DataSource } from '@/core/config/env';
import { notImplemented } from '@/core/di/notImplemented';
import { sharedMemoryHouseholdLedger } from '@/features/household/data/sharedMemoryHousehold';

import { InMemorySettlementRepository } from './data/InMemorySettlementRepository';
import type { SettlementRepository } from './domain/SettlementRepository';
import {
  CreateSettlement,
  GetBalance,
  ListSettlements,
} from './domain/usecases/SettlementUseCases';

export interface SettlementsModuleConfig {
  readonly dataSource: DataSource;
}

/**
 * Feature module: repository → use cases. In `memory` the balance is computed from the shared
 * in-memory household. The `api` source is chosen in the 5.9 integration.
 */
export function createSettlementsModule(config: SettlementsModuleConfig) {
  const repository: SettlementRepository =
    config.dataSource === 'memory'
      ? new InMemorySettlementRepository(sharedMemoryHouseholdLedger())
      : notImplemented<SettlementRepository>(
          `settlements(${config.dataSource}).settlementRepository`,
        );

  return {
    settlementRepository: repository,
    getBalance: new GetBalance(repository),
    listSettlements: new ListSettlements(repository),
    createSettlement: new CreateSettlement(repository),
  };
}

export type SettlementsModule = ReturnType<typeof createSettlementsModule>;
