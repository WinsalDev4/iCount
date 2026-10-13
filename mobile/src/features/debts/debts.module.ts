import type { DataSource } from '@/core/config/env';
import { notImplemented } from '@/core/di/notImplemented';

import type { DebtRepository } from './domain/DebtRepository';

export interface DebtsModuleConfig {
  readonly dataSource: DataSource;
}

/**
 * Stub from the global preparation (G.0, phase 4) so the container already
 * composes it. Phase 4 tasks fill in the in-memory and API implementations.
 */
export function createDebtsModule(config: DebtsModuleConfig) {
  return {
    debtRepository: notImplemented<DebtRepository>(`debts(${config.dataSource}).debtRepository`),
  };
}

export type DebtsModule = ReturnType<typeof createDebtsModule>;
