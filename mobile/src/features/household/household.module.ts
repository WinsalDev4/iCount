import type { DataSource } from '@/core/config/env';
import { notImplemented } from '@/core/di/notImplemented';

import { InMemoryHouseholdRepository } from './data/InMemoryHouseholdRepository';
import type { HouseholdRepository } from './domain/HouseholdRepository';
import { CreateHousehold } from './domain/usecases/CreateHousehold';
import { CreateInvite } from './domain/usecases/CreateInvite';
import { GetMyHouseholds } from './domain/usecases/GetMyHouseholds';
import { JoinHousehold } from './domain/usecases/JoinHousehold';
import { SetMyIncome } from './domain/usecases/SetMyIncome';
import { SetSplitRule } from './domain/usecases/SetSplitRule';

export interface HouseholdModuleConfig {
  readonly dataSource: DataSource;
}

/**
 * Feature module: repository → use cases. `memory` keeps everything in the device; the `api`
 * source is picked in the 2.9 integration (ApiHouseholdRepository needs the authenticated
 * client that the container owns), so for now it stays a stub.
 */
export function createHouseholdModule(config: HouseholdModuleConfig) {
  const repository: HouseholdRepository =
    config.dataSource === 'memory'
      ? new InMemoryHouseholdRepository()
      : notImplemented<HouseholdRepository>(`household(${config.dataSource}).householdRepository`);

  return {
    householdRepository: repository,
    getMyHouseholds: new GetMyHouseholds(repository),
    createHousehold: new CreateHousehold(repository),
    createInvite: new CreateInvite(repository),
    joinHousehold: new JoinHousehold(repository),
    setSplitRule: new SetSplitRule(repository),
    setMyIncome: new SetMyIncome(repository),
  };
}

export type HouseholdModule = ReturnType<typeof createHouseholdModule>;
