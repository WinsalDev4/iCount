import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';

import { createContainer } from '@/core/di/container';
import { DependenciesProvider } from '@/core/di/DependenciesProvider';
import type { HouseholdId, UserId } from '@/core/domain/Ids';
import { queryKeys } from '@/core/query/queryKeys';
import { sessionQueryKey } from '@/features/auth/presentation/session';
import type { Household, Member } from '@/features/household/domain/Household';

import {
  InMemoryTransactionRepository,
  type InMemoryTransactionOptions,
} from '../data/InMemoryTransactionRepository';
import type { TransactionRepository } from '../domain/TransactionRepository';
import { CreateTransaction } from '../domain/usecases/CreateTransaction';
import { GetMonthlySummary } from '../domain/usecases/GetMonthlySummary';

export const ME = 'u-me' as UserId;
export const ANA = 'u-ana' as UserId;

const member = (userId: UserId, name: string, role: Member['role']): Member => ({
  userId,
  email: `${name.toLowerCase()}@casa.app`,
  displayName: name,
  role,
  monthlyIncome: null,
});

export function householdOf(kind: 'personal' | 'shared', withPartner = false): Household {
  return {
    id: 'h1' as HouseholdId,
    name: 'Casa',
    kind,
    currency: 'EUR',
    splitRule: { kind: 'equal' },
    members: withPartner
      ? [member(ME, 'Leo', 'admin'), member(ANA, 'Ana', 'member')]
      : [member(ME, 'Leo', 'admin')],
  };
}

/**
 * A throw-away container + QueryClient for hooks of the transactions screens: the real use cases
 * over an in-memory repository (empty by default), a signed-in user and an active household
 * already in the cache.
 */
export function createTransactionsTestKit(
  options: {
    household?: Household;
    repository?: TransactionRepository;
    memory?: InMemoryTransactionOptions;
  } = {},
) {
  const household = options.household ?? householdOf('personal');
  const repository =
    options.repository ??
    new InMemoryTransactionRepository({
      seedDemoData: false,
      me: () => ME,
      ...options.memory,
    });

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
    transactions: {
      transactionRepository: repository,
      getMonthlySummary: new GetMonthlySummary(repository, 'EUR'),
      createTransaction: new CreateTransaction(repository),
    },
  };

  function Wrapper({ children }: PropsWithChildren) {
    return (
      <DependenciesProvider container={container}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </DependenciesProvider>
    );
  }

  return { Wrapper, queryClient, repository, household };
}
