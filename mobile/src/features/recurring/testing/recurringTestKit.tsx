import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';

import { createContainer } from '@/core/di/container';
import { DependenciesProvider } from '@/core/di/DependenciesProvider';
import type { HouseholdId, UserId } from '@/core/domain/Ids';
import type { NotificationPermission } from '@/core/notifications/NotificationsGateway';
import { queryKeys } from '@/core/query/queryKeys';
import { sessionQueryKey } from '@/features/auth/presentation/session';
import type { Household } from '@/features/household/domain/Household';

import {
  InMemoryRecurringRepository,
  type InMemoryRecurringOptions,
} from '../data/InMemoryRecurringRepository';
import { remindersPreferenceStore } from '../data/remindersPreferenceStore';
import type { ReminderPlan, RemindersScheduler } from '../domain/RemindersScheduler';
import {
  CreateRecurringPayment,
  DeleteRecurringPayment,
  ListRecurringPayments,
  ListUpcomingDues,
  SyncReminders,
  UpdateRecurringPayment,
} from '../domain/usecases/RecurringUseCases';

const ME = 'u-me' as UserId;
const PARTNER = 'u-partner' as UserId;

export const household: Household = {
  id: 'h1' as HouseholdId,
  name: 'Casa',
  kind: 'shared',
  currency: 'EUR',
  splitRule: { kind: 'equal' },
  members: [
    { userId: ME, email: 'leo@casa.app', displayName: 'Leo', role: 'admin', monthlyIncome: null },
    {
      userId: PARTNER,
      email: 'ana@casa.app',
      displayName: 'Ana',
      role: 'member',
      monthlyIncome: null,
    },
  ],
};

/** A scheduler that remembers what it was asked, with the OS answers set by each test. */
export class FakeRemindersScheduler implements RemindersScheduler {
  permissionNow: NotificationPermission = 'granted';
  /** What the OS prompt answers when asked. */
  promptAnswer: NotificationPermission = 'granted';
  failReplace = false;
  readonly requests: number[] = [];
  readonly replaced: (readonly ReminderPlan[])[] = [];
  cancelAllCalls = 0;

  async permission() {
    return this.permissionNow;
  }
  async requestPermission() {
    this.requests.push(Date.now());
    this.permissionNow = this.promptAnswer;
    return this.promptAnswer;
  }
  async replaceAll(plans: readonly ReminderPlan[]) {
    if (this.failReplace) throw new Error('native failure');
    this.replaced.push(plans);
  }
  async cancelAll() {
    this.cancelAllCalls += 1;
  }
}

/**
 * A throw-away container + QueryClient for the recurring screens: the real use cases over an
 * in-memory repository (empty by default), a fake reminders scheduler, and the persisted
 * "reminders on" switch reset to `remindersEnabled`.
 */
export function createRecurringTestKit(
  memory: InMemoryRecurringOptions = {},
  options: { remindersEnabled?: boolean } = {},
) {
  const repository = new InMemoryRecurringRepository({ payments: [], ...memory });
  const scheduler = new FakeRemindersScheduler();
  remindersPreferenceStore.setState({ enabled: options.remindersEnabled ?? false, hydrated: true });

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
    recurring: {
      recurringPaymentRepository: repository,
      remindersScheduler: scheduler,
      listRecurringPayments: new ListRecurringPayments(repository),
      createRecurringPayment: new CreateRecurringPayment(repository),
      updateRecurringPayment: new UpdateRecurringPayment(repository),
      deleteRecurringPayment: new DeleteRecurringPayment(repository),
      listUpcomingDues: new ListUpcomingDues(repository),
      syncReminders: new SyncReminders(repository, scheduler),
    },
  };

  function Wrapper({ children }: PropsWithChildren) {
    return (
      <DependenciesProvider container={container}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </DependenciesProvider>
    );
  }

  return { Wrapper, queryClient, repository, scheduler };
}
