import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';

import { createContainer } from '@/core/di/container';
import { DependenciesProvider } from '@/core/di/DependenciesProvider';
import type { HouseholdId, UserId } from '@/core/domain/Ids';
import { queryKeys } from '@/core/query/queryKeys';
import { sessionQueryKey } from '@/features/auth/presentation/session';
import type { Household } from '@/features/household/domain/Household';

import { InMemoryDebtRepository, type InMemoryDebtOptions } from '../data/InMemoryDebtRepository';
import { ComparePayoffStrategies } from '../domain/usecases/ComparePayoffStrategies';
import {
  CreateDebt,
  DeleteDebt,
  GetAmortizationSchedule,
  GetDebt,
  ListDebts,
  UpdateDebt,
} from '../domain/usecases/DebtUseCases';
import { SimulateExtraPayment } from '../domain/usecases/SimulateExtraPayment';

const ME = 'u-me' as UserId;

export const household: Household = {
  id: 'h1' as HouseholdId,
  name: 'Casa',
  kind: 'personal',
  currency: 'EUR',
  splitRule: { kind: 'equal' },
  members: [
    { userId: ME, email: 'leo@casa.app', displayName: 'Leo', role: 'admin', monthlyIncome: null },
  ],
};

/**
 * A throw-away container + QueryClient for the debts screens: the real use cases over an
 * in-memory repository (empty by default, today fixed by the tests through fake timers).
 */
export function createDebtsTestKit(memory: InMemoryDebtOptions = {}) {
  const repository = new InMemoryDebtRepository({ debts: [], ...memory });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
  queryClient.setQueryData(sessionQueryKey, {
    user: { id: ME, email: 'leo@casa.app', displayName: 'Leo' },
  });
  queryClient.setQueryData(queryKeys.households.mine(), [household]);

  const base = createContainer({ dataSource: 'memory' });
  const container = {
    ...base,
    debts: {
      debtRepository: repository,
      listDebts: new ListDebts(repository),
      getDebt: new GetDebt(repository),
      getAmortizationSchedule: new GetAmortizationSchedule(repository),
      createDebt: new CreateDebt(repository),
      updateDebt: new UpdateDebt(repository),
      deleteDebt: new DeleteDebt(repository),
      simulateExtraPayment: new SimulateExtraPayment(),
      comparePayoffStrategies: new ComparePayoffStrategies(),
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
