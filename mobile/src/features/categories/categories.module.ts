import type { DataSource } from '@/core/config/env';
import { notImplemented } from '@/core/di/notImplemented';

import type { CategoryRepository } from './domain/CategoryRepository';

export interface CategoriesModuleConfig {
  readonly dataSource: DataSource;
}

/**
 * Stub from the global preparation (G.0, phase 3) so the container already
 * composes it. Phase 3 tasks fill in the in-memory and API repositories.
 */
export function createCategoriesModule(config: CategoriesModuleConfig) {
  return {
    categoryRepository: notImplemented<CategoryRepository>(
      `categories(${config.dataSource}).categoryRepository`,
    ),
  };
}

export type CategoriesModule = ReturnType<typeof createCategoriesModule>;
