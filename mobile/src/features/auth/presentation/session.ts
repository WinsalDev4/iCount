import { useQuery, type QueryClient } from '@tanstack/react-query';

import { useDependencies } from '@/core/di/DependenciesProvider';

import { accessStore } from '../data/accessStore';
import type { Session } from '../domain/User';

export const sessionQueryKey = ['session'] as const;

/**
 * The stored session as a query. It is the single source of "am I signed in?":
 * sign-in writes it with `startSession`, sign-out with `endSession`.
 * `persist: false` keeps it out of the on-disk query cache (it holds the user's email).
 */
export function useSessionQuery() {
  const { getSession } = useDependencies().auth;
  return useQuery({
    queryKey: sessionQueryKey,
    queryFn: () => getSession.execute(),
    staleTime: Infinity,
    meta: { persist: false },
  });
}

/**
 * A fresh sign-in proves the person is there: no biometric prompt right after it.
 * The read of the stored session may still be in flight (deep link on a cold start); it is
 * cancelled first, otherwise its stale "signed out" answer would overwrite this sign-in.
 */
export async function startSession(queryClient: QueryClient, session: Session): Promise<void> {
  await queryClient.cancelQueries({ queryKey: sessionQueryKey });
  queryClient.setQueryData(sessionQueryKey, session);
  accessStore.getState().unlock();
}

/**
 * Forget everything of the previous user: the session and every cached query
 * (the cache holds their financial data, ADR-0014).
 */
export function endSession(queryClient: QueryClient): void {
  accessStore.getState().lock();
  queryClient.clear();
  queryClient.setQueryData(sessionQueryKey, null);
}
