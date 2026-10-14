import type { DataSource } from '@/core/config/env';
import { notImplemented } from '@/core/di/notImplemented';

import type { SettlementRepository } from './domain/SettlementRepository';

export interface SettlementsModuleConfig {
  readonly dataSource: DataSource;
}

/**
 * Stub from the global preparation (G.0, phase 5) so the container already
 * composes it. Phase 5 tasks fill in the in-memory and API implementations.
 */
export function createSettlementsModule(config: SettlementsModuleConfig) {
  return {
    settlementRepository: notImplemented<SettlementRepository>(
      `settlements(${config.dataSource}).settlementRepository`,
    ),
  };
}

export type SettlementsModule = ReturnType<typeof createSettlementsModule>;
