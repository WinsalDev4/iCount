import { type FeatureContext, requireApi } from '@/core/di/FeatureContext';

import { ApiCategoryRepository } from './data/api/ApiCategoryRepository';
import { InMemoryCategoryRepository } from './data/InMemoryCategoryRepository';
import type { CategoryRepository } from './domain/CategoryRepository';
import { ListCategories } from './domain/usecases/ListCategories';

/**
 * Feature module: repository → use cases. `memory` has the built-in categories; `api` reads the
 * household's categories with the authenticated client the container owns.
 */
export function createCategoriesModule(context: FeatureContext) {
  const repository: CategoryRepository =
    context.dataSource === 'memory'
      ? new InMemoryCategoryRepository()
      : new ApiCategoryRepository(requireApi(context, 'categories').http);

  return {
    categoryRepository: repository,
    listCategories: new ListCategories(repository),
  };
}

export type CategoriesModule = ReturnType<typeof createCategoriesModule>;
