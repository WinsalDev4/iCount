import { useQuery, type QueryClient } from '@tanstack/react-query';

import { useDependencies } from '@/core/di/DependenciesProvider';
import { queryKeys } from '@/core/query/queryKeys';

import type { Household } from '../domain/Household';

/**
 * The households of the signed-in user. Persisted with the rest of the cache (ADR-0014): the app
 * must open offline on the active household. It holds members' emails, no more sensitive than the
 * movements already cached, and the whole cache is wiped on sign-out.
 */
export function useMyHouseholds({ enabled = true }: { enabled?: boolean } = {}) {
  const { getMyHouseholds } = useDependencies().household;
  return useQuery({
    queryKey: queryKeys.households.mine(),
    queryFn: () => getMyHouseholds.execute(),
    enabled,
    staleTime: Infinity,
  });
}

/** The household the app works on: the first one (switching households is a later feature). */
export function useActiveHousehold(): Household | undefined {
  return useMyHouseholds().data?.[0];
}

/** Puts a created / joined / updated household in the cache without another request. */
export function upsertHousehold(queryClient: QueryClient, household: Household): void {
  queryClient.setQueryData<readonly Household[]>(queryKeys.households.mine(), (current = []) => {
    const exists = current.some((h) => h.id === household.id);
    return exists
      ? current.map((h) => (h.id === household.id ? household : h))
      : [...current, household];
  });
}
