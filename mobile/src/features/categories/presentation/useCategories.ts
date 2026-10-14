import { useQuery } from '@tanstack/react-query';

import { useDependencies } from '@/core/di/DependenciesProvider';
import { queryKeys } from '@/core/query/queryKeys';

import type { Category } from '../domain/Category';

/** Every category of a household (built-in + custom). Filter with `categoriesFor`. */
export function useCategories(householdId: string | undefined) {
  const { listCategories } = useDependencies().categories;
  return useQuery({
    queryKey: queryKeys.categories.all(householdId ?? 'none'),
    queryFn: () => listCategories.execute(householdId ?? ''),
    enabled: householdId !== undefined,
    staleTime: Infinity,
  });
}

/** The categories that can classify an expense or an income. */
export function categoriesFor(
  categories: readonly Category[],
  type: 'expense' | 'income',
): readonly Category[] {
  return categories.filter((c) => c.kind === type || c.kind === 'both');
}
