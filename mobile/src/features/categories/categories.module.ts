import type { DataSource } from '@/core/config/env';
import { notImplemented } from '@/core/di/notImplemented';

import { InMemoryCategoryRepository } from './data/InMemoryCategoryRepository';
import type { CategoryRepository } from './domain/CategoryRepository';
import { ListCategories } from './domain/usecases/ListCategories';

export interface CategoriesModuleConfig {
  readonly dataSource: DataSource;
}

/**
 * Feature module: repository → use cases. `memory` has the built-in categories; the `api` source
 * (ApiCategoryRepository needs the authenticated client the container owns) is chosen in 3.9.
 */
export function createCategoriesModule(config: CategoriesModuleConfig) {
  const repository: CategoryRepository =
    config.dataSource === 'memory'
      ? new InMemoryCategoryRepository()
      : notImplemented<CategoryRepository>(`categories(${config.dataSource}).categoryRepository`);

  return {
    categoryRepository: repository,
    listCategories: new ListCategories(repository),
  };
}

export type CategoriesModule = ReturnType<typeof createCategoriesModule>;
