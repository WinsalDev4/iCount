import type { DataSource } from '@/core/config/env';
import { notImplemented } from '@/core/di/notImplemented';

import { ExpoRemindersScheduler } from './data/ExpoRemindersScheduler';
import { InMemoryRecurringRepository } from './data/InMemoryRecurringRepository';
import type { RecurringPaymentRepository } from './domain/RecurringPaymentRepository';
import type { RemindersScheduler } from './domain/RemindersScheduler';
import {
  CreateRecurringPayment,
  DeleteRecurringPayment,
  ListRecurringPayments,
  ListUpcomingDues,
  SyncReminders,
  UpdateRecurringPayment,
} from './domain/usecases/RecurringUseCases';

export interface RecurringModuleConfig {
  readonly dataSource: DataSource;
}

/**
 * Feature module: repository → use cases, plus the local reminders. The reminders are scheduled
 * on the device whatever the data source is (they need no server). The `api` source is chosen
 * in the 4.9 integration (needs the authenticated client).
 */
export function createRecurringModule(config: RecurringModuleConfig) {
  const repository: RecurringPaymentRepository =
    config.dataSource === 'memory'
      ? new InMemoryRecurringRepository()
      : notImplemented<RecurringPaymentRepository>(
          `recurring(${config.dataSource}).recurringPaymentRepository`,
        );
  const reminders: RemindersScheduler = new ExpoRemindersScheduler();

  return {
    recurringPaymentRepository: repository,
    remindersScheduler: reminders,
    listRecurringPayments: new ListRecurringPayments(repository),
    createRecurringPayment: new CreateRecurringPayment(repository),
    updateRecurringPayment: new UpdateRecurringPayment(repository),
    deleteRecurringPayment: new DeleteRecurringPayment(repository),
    listUpcomingDues: new ListUpcomingDues(repository),
    syncReminders: new SyncReminders(repository, reminders),
  };
}

export type RecurringModule = ReturnType<typeof createRecurringModule>;
