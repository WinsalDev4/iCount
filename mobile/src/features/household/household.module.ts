import { type FeatureContext, requireApi } from '@/core/di/FeatureContext';

import { ApiHouseholdRepository } from './data/api/ApiHouseholdRepository';
import { sharedMemoryHouseholdRepository } from './data/sharedMemoryHousehold';
import type { HouseholdRepository } from './domain/HouseholdRepository';
import { CreateHousehold } from './domain/usecases/CreateHousehold';
import { CreateInvite } from './domain/usecases/CreateInvite';
import { GetMyHouseholds } from './domain/usecases/GetMyHouseholds';
import { JoinHousehold } from './domain/usecases/JoinHousehold';
import { SetMyIncome } from './domain/usecases/SetMyIncome';
import { SetSplitRule } from './domain/usecases/SetSplitRule';

/**
 * Feature module: repository → use cases. `memory` keeps everything in the device; `api` uses
 * the authenticated client the container owns.
 */
export function createHouseholdModule(context: FeatureContext) {
  const repository: HouseholdRepository =
    context.dataSource === 'memory'
      ? sharedMemoryHouseholdRepository()
      : new ApiHouseholdRepository(requireApi(context, 'household').http);

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
