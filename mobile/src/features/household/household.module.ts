import type { DataSource } from '@/core/config/env';
import { notImplemented } from '@/core/di/notImplemented';

import type { HouseholdRepository } from './domain/HouseholdRepository';

export interface HouseholdModuleConfig {
  readonly dataSource: DataSource;
}

/**
 * Stub from task 2.0 so the container already composes it.
 * B-2.3 wires InMemoryHouseholdRepository and the use cases; 2.9 picks
 * ApiHouseholdRepository when `dataSource === 'api'`.
 */
export function createHouseholdModule(config: HouseholdModuleConfig) {
  return {
    householdRepository: notImplemented<HouseholdRepository>(
      `household(${config.dataSource}).householdRepository`,
    ),
  };
}

export type HouseholdModule = ReturnType<typeof createHouseholdModule>;
