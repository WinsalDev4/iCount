import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useDependencies } from '@/core/di/DependenciesProvider';
import { clearPersistedQueryCache } from '@/core/query/persistence';
import { queryCacheStorage } from '@/core/storage/mmkvStorage';

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
  // First "signed out" on the live session query: its observers (the access gate) re-render and
  // the signed-in screens unmount. `clear()` alone would not notify them: mounted screens would
  // keep showing the previous user's data.
  queryClient.setQueryData(sessionQueryKey, null);
  queryClient.removeQueries({
    predicate: (query) => query.queryKey[0] !== sessionQueryKey[0],
  });
  // Also on disk at once, not on the persister's next throttled write.
  clearPersistedQueryCache(queryCacheStorage);
}

/**
 * When the server rejects the session on its own (revoked, refresh token reused or expired),
 * forget it here too and go back to sign-in. Only the API data source has a device session.
 * Android analogy: the OkHttp Authenticator giving up and the app routing to login.
 */
export function useSessionExpiry(): void {
  const { session } = useDependencies();
  const queryClient = useQueryClient();
  useEffect(() => session?.onSessionExpired(() => endSession(queryClient)), [session, queryClient]);
}
