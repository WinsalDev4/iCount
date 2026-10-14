import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';

import { InMemoryActivityRepository } from '@/features/activity/data/InMemoryActivityRepository';
import {
  AddComment,
  DecideApproval,
  ListActivity,
  ListComments,
} from '@/features/activity/domain/usecases/ActivityUseCases';
import { createContainer } from '@/core/di/container';
import { DependenciesProvider } from '@/core/di/DependenciesProvider';
import type { HouseholdId, UserId } from '@/core/domain/Ids';
import { Money } from '@/core/domain/Money';
import { queryKeys } from '@/core/query/queryKeys';
import { sessionQueryKey } from '@/features/auth/presentation/session';
import { InMemorySettlementRepository } from '@/features/settlements/data/InMemorySettlementRepository';
import {
  CreateSettlement,
  GetBalance,
  ListSettlements,
} from '@/features/settlements/domain/usecases/SettlementUseCases';
import { InMemoryTransactionRepository } from '@/features/transactions/data/InMemoryTransactionRepository';

import { InMemoryHouseholdLedger } from '../data/InMemoryHouseholdLedger';
import type { Household, Member } from '../domain/Household';

export const ME = 'u-me' as UserId;
export const ANA = 'u-ana' as UserId;

const member = (
  userId: UserId,
  name: string,
  role: Member['role'],
  income: number | null = null,
): Member => ({
  userId,
  email: `${name.toLowerCase()}@casa.app`,
  displayName: name,
  role,
  monthlyIncome: income === null ? null : Money.ofMinor(income, 'EUR'),
});

/** A couple (Leo = me, first; Ana) or just me. */
export function householdFor(shared: boolean): Household {
  return {
    id: 'h1' as HouseholdId,
    name: 'Casa Ana & Leo',
    kind: shared ? 'shared' : 'personal',
    currency: 'EUR',
    splitRule: { kind: 'equal' },
    members: shared
      ? [member(ME, 'Leo', 'admin'), member(ANA, 'Ana', 'member', 200_000)]
      : [member(ME, 'Leo', 'admin')],
  };
}

/**
 * A throw-away container + QueryClient for the Hogar tab: the real use cases over an in-memory
 * transaction store and ledger (today fixed by the test with fake timers), signed in as Leo.
 */
export function createHouseholdTabTestKit(options: { shared?: boolean } = {}) {
  const household = householdFor(options.shared ?? true);
  const transactions = new InMemoryTransactionRepository({
    transactions: [],
    me: () => ME,
    now: () => new Date(),
  });
  const ledger = new InMemoryHouseholdLedger({
    transactions,
    households: { getMine: async () => [household] },
    me: () => ME,
    now: () => new Date(),
  });
  const activity = new InMemoryActivityRepository(ledger, transactions);
  const settlements = new InMemorySettlementRepository(ledger);

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
    household: {
      ...base.household,
      createInvite: {
        execute: async () => ({ code: 'ABCD2345', expiresAt: new Date(2026, 9, 16) }),
      },
    },
    activity: {
      activityRepository: activity,
      listActivity: new ListActivity(activity),
      decideApproval: new DecideApproval(activity),
      listComments: new ListComments(activity),
      addComment: new AddComment(activity),
    },
    settlements: {
      settlementRepository: settlements,
      getBalance: new GetBalance(settlements),
      listSettlements: new ListSettlements(settlements),
      createSettlement: new CreateSettlement(settlements),
    },
  };

  function Wrapper({ children }: PropsWithChildren) {
    return (
      <DependenciesProvider container={container as unknown as typeof base}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </DependenciesProvider>
    );
  }

  return { Wrapper, queryClient, ledger, activity, settlements, transactions, household };
}
