import type { DataSource } from '@/core/config/env';
import { notImplemented } from '@/core/di/notImplemented';

import type { AdvisorRepository } from './domain/AdvisorRepository';

export interface AdvisorModuleConfig {
  readonly dataSource: DataSource;
}

/**
 * Stub from the global preparation (G.0, phase 7) so the container already
 * composes it. Phase 7 tasks fill in the in-memory and API implementations.
 */
export function createAdvisorModule(config: AdvisorModuleConfig) {
  return {
    advisorRepository: notImplemented<AdvisorRepository>(
      `advisor(${config.dataSource}).advisorRepository`,
    ),
  };
}

export type AdvisorModule = ReturnType<typeof createAdvisorModule>;
