import type { DataSource } from '@/core/config/env';
import { notImplemented } from '@/core/di/notImplemented';

import type { RecurringPaymentRepository } from './domain/RecurringPaymentRepository';

export interface RecurringModuleConfig {
  readonly dataSource: DataSource;
}

/**
 * Stub from the global preparation (G.0, phase 4) so the container already
 * composes it. Phase 4 tasks fill in the in-memory and API implementations.
 */
export function createRecurringModule(config: RecurringModuleConfig) {
  return {
    recurringPaymentRepository: notImplemented<RecurringPaymentRepository>(
      `recurring(${config.dataSource}).recurringPaymentRepository`,
    ),
  };
}

export type RecurringModule = ReturnType<typeof createRecurringModule>;
