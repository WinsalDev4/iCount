import type { DataSource } from '@/core/config/env';
import { notImplemented } from '@/core/di/notImplemented';
import { sharedMemoryHouseholdLedger } from '@/features/household/data/sharedMemoryHousehold';
import { sharedMemoryTransactionRepository } from '@/features/transactions/data/sharedMemoryRepository';

import { InMemoryActivityRepository } from './data/InMemoryActivityRepository';
import type { ActivityRepository } from './domain/ActivityRepository';
import {
  AddComment,
  DecideApproval,
  ListActivity,
  ListComments,
} from './domain/usecases/ActivityUseCases';

export interface ActivityModuleConfig {
  readonly dataSource: DataSource;
}

/**
 * Feature module: repository → use cases. In `memory` the feed is derived from the shared
 * in-memory household (movements, decisions, comments, settlements). The `api` source is chosen
 * in the 5.9 integration (needs the authenticated client).
 */
export function createActivityModule(config: ActivityModuleConfig) {
  const repository: ActivityRepository =
    config.dataSource === 'memory'
      ? new InMemoryActivityRepository(
          sharedMemoryHouseholdLedger(),
          sharedMemoryTransactionRepository(),
        )
      : notImplemented<ActivityRepository>(`activity(${config.dataSource}).activityRepository`);

  return {
    activityRepository: repository,
    listActivity: new ListActivity(repository),
    decideApproval: new DecideApproval(repository),
    listComments: new ListComments(repository),
    addComment: new AddComment(repository),
  };
}

export type ActivityModule = ReturnType<typeof createActivityModule>;
