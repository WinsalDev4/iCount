import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';

import { createContainer } from '@/core/di/container';
import { DependenciesProvider } from '@/core/di/DependenciesProvider';
import type { HouseholdId, UserId } from '@/core/domain/Ids';
import { queryKeys } from '@/core/query/queryKeys';
import { sessionQueryKey } from '@/features/auth/presentation/session';
import type { Household, Member } from '@/features/household/domain/Household';

import {
  InMemoryBudgetRepository,
  type InMemoryBudgetOptions,
} from '@/features/budgets/data/InMemoryBudgetRepository';
import {
  CreateBudget,
  DeleteBudget,
  ListBudgets,
  MoveBudgetAmount,
  UpdateBudgetLimit,
} from '@/features/budgets/domain/usecases/BudgetUseCases';
import {
  InMemoryTransactionRepository,
  type InMemoryTransactionOptions,
} from '../data/InMemoryTransactionRepository';
import type { TransactionRepository } from '../domain/TransactionRepository';
import { CreateTransaction } from '../domain/usecases/CreateTransaction';
import {
  DeleteTransaction,
  GetDailyTotals,
  GetTransaction,
  ListTransactions,
  UpdateTransaction,
} from '../domain/usecases/TransactionUseCases';
import { GetDailyAllowance } from '../domain/usecases/GetDailyAllowance';
import { GetMonthlySummary } from '../domain/usecases/GetMonthlySummary';
import { GetRecentTransactions } from '../domain/usecases/GetRecentTransactions';
import { GetWeeklySpending } from '../domain/usecases/GetWeeklySpending';

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
    /** Budgets of the household; none by default (the demo budgets are off). */
    budgets?: InMemoryBudgetOptions;
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

  const budgetRepository = new InMemoryBudgetRepository(repository, {
    seedDemoData: false,
    ...options.budgets,
  });

  const base = createContainer({ dataSource: 'memory' });
  const container = {
    ...base,
    budgets: {
      budgetRepository,
      listBudgets: new ListBudgets(budgetRepository),
      createBudget: new CreateBudget(budgetRepository),
      updateBudgetLimit: new UpdateBudgetLimit(budgetRepository),
      deleteBudget: new DeleteBudget(budgetRepository),
      moveBudgetAmount: new MoveBudgetAmount(budgetRepository),
    },
    transactions: {
      transactionRepository: repository,
      getMonthlySummary: new GetMonthlySummary(repository, 'EUR'),
      createTransaction: new CreateTransaction(repository),
      getDailyAllowance: new GetDailyAllowance(repository, 'EUR'),
      getWeeklySpending: new GetWeeklySpending(repository, 'EUR'),
      getRecentTransactions: new GetRecentTransactions(repository),
      listTransactions: new ListTransactions(repository),
      getTransaction: new GetTransaction(repository),
      getDailyTotals: new GetDailyTotals(repository),
      updateTransaction: new UpdateTransaction(repository),
      deleteTransaction: new DeleteTransaction(repository),
    },
  };

  function Wrapper({ children }: PropsWithChildren) {
    return (
      <DependenciesProvider container={container}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </DependenciesProvider>
    );
  }

  return { Wrapper, queryClient, repository, budgetRepository, household };
}
