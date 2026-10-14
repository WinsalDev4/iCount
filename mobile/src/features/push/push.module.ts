import type { DataSource } from '@/core/config/env';
import { notImplemented } from '@/core/di/notImplemented';

import type { PushRepository } from './domain/PushRepository';

export interface PushModuleConfig {
  readonly dataSource: DataSource;
}

/**
 * Stub from the global preparation (G.0, phase 5) so the container already
 * composes it. Phase 5 tasks fill in the in-memory and API implementations.
 */
export function createPushModule(config: PushModuleConfig) {
  return {
    pushRepository: notImplemented<PushRepository>(`push(${config.dataSource}).pushRepository`),
  };
}

export type PushModule = ReturnType<typeof createPushModule>;
