import type { DataSource } from '@/core/config/env';
import { notImplemented } from '@/core/di/notImplemented';

import type { ActivityRepository } from './domain/ActivityRepository';

export interface ActivityModuleConfig {
  readonly dataSource: DataSource;
}

/**
 * Stub from the global preparation (G.0, phase 5) so the container already
 * composes it. Phase 5 tasks fill in the in-memory and API implementations.
 */
export function createActivityModule(config: ActivityModuleConfig) {
  return {
    activityRepository: notImplemented<ActivityRepository>(
      `activity(${config.dataSource}).activityRepository`,
    ),
  };
}

export type ActivityModule = ReturnType<typeof createActivityModule>;
