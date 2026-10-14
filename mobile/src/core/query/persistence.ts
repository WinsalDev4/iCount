import { API_VERSION } from '@icount/contracts';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import type { Query } from '@tanstack/react-query';

import type { SyncKeyValueStorage } from '@/core/storage/keyValueStorage';

import { deserializeCache, serializeCache } from './cacheSerialization';

export const QUERY_CACHE_KEY = 'icount.query-cache.v1';
/** Older than this, the persisted cache is discarded instead of shown. */
export const QUERY_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/** A new API contract version invalidates every persisted cache (shapes may have changed). */
export const QUERY_CACHE_BUSTER = `contracts-v${API_VERSION}`;

export interface QueryMeta {
  /** Set to false on queries that must never be written to disk. */
  readonly persist?: boolean;
}

/**
 * Every query that holds data is persisted, also when its last refresh failed: offline, a failed
 * refresh must not erase the last known data from disk. Pending queries have nothing to keep.
 */
export function shouldPersistQuery(query: Query): boolean {
  const meta = query.meta as QueryMeta | undefined;
  return query.state.data !== undefined && meta?.persist !== false;
}

/**
 * Options for `<PersistQueryClientProvider persistOptions={…}>` (connected in 3.9):
 * the last known cache shows instantly on start, even offline (ADR-0014).
 */
export function createPersistOptions(
  storage: SyncKeyValueStorage,
  { throttleTimeMs = 1_000 }: { throttleTimeMs?: number } = {},
) {
  return {
    persister: createSyncStoragePersister({
      storage,
      key: QUERY_CACHE_KEY,
      // Writes are batched: at most one serialisation per second.
      throttleTime: throttleTimeMs,
      // Money, Date and Map come back as themselves, not as plain JSON.
      serialize: serializeCache,
      deserialize: deserializeCache,
    }),
    maxAge: QUERY_CACHE_MAX_AGE_MS,
    buster: QUERY_CACHE_BUSTER,
    dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
  };
}

/** On sign-out: the cache holds financial data of the previous user. */
export function clearPersistedQueryCache(storage: SyncKeyValueStorage): void {
  storage.removeItem(QUERY_CACHE_KEY);
}
