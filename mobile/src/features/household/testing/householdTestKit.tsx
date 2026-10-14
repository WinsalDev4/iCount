import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';

import { createContainer } from '@/core/di/container';
import { DependenciesProvider } from '@/core/di/DependenciesProvider';

import {
  InMemoryHouseholdRepository,
  type InMemoryHouseholdOptions,
} from '../data/InMemoryHouseholdRepository';
import type { HouseholdRepository } from '../domain/HouseholdRepository';
import { CreateHousehold } from '../domain/usecases/CreateHousehold';
import { CreateInvite } from '../domain/usecases/CreateInvite';
import { GetMyHouseholds } from '../domain/usecases/GetMyHouseholds';
import { JoinHousehold } from '../domain/usecases/JoinHousehold';
import { SetMyIncome } from '../domain/usecases/SetMyIncome';
import { SetSplitRule } from '../domain/usecases/SetSplitRule';

/**
 * A throw-away container + QueryClient around a hook under test: the real household use cases
 * over the given repository (in-memory by default, with a fixed invite code).
 */
export function createHouseholdTestKit(
  options: { repository?: HouseholdRepository; memory?: InMemoryHouseholdOptions } = {},
) {
  const repository =
    options.repository ??
    new InMemoryHouseholdRepository({ randomCode: () => 'ABCD2345', ...options.memory });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });

  const base = createContainer({ dataSource: 'memory' });
  const container = {
    ...base,
    household: {
      householdRepository: repository,
      getMyHouseholds: new GetMyHouseholds(repository),
      createHousehold: new CreateHousehold(repository),
      createInvite: new CreateInvite(repository),
      joinHousehold: new JoinHousehold(repository),
      setSplitRule: new SetSplitRule(repository),
      setMyIncome: new SetMyIncome(repository),
    },
  };

  function Wrapper({ children }: PropsWithChildren) {
    return (
      <DependenciesProvider container={container}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </DependenciesProvider>
    );
  }

  return { Wrapper, queryClient, repository };
}
