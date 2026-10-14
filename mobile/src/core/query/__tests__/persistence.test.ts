import { QueryClient } from '@tanstack/react-query';
import {
  persistQueryClientRestore,
  persistQueryClientSave,
} from '@tanstack/react-query-persist-client';

import { createMemoryStorage } from '@/core/storage/keyValueStorage';

import {
  clearPersistedQueryCache,
  createPersistOptions,
  QUERY_CACHE_BUSTER,
  QUERY_CACHE_KEY,
} from '../persistence';

/** gcTime Infinity: no garbage-collection timers left running after the test. */
const testClient = () => new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });

async function seededClient() {
  const queryClient = testClient();
  await queryClient.prefetchQuery({
    queryKey: ['summary'],
    queryFn: async () => ({ balance: 1_071_75 }),
  });
  await queryClient.prefetchQuery({
    queryKey: ['private'],
    queryFn: async () => 'secret',
    meta: { persist: false },
  });
  await queryClient
    .prefetchQuery({
      queryKey: ['broken'],
      queryFn: async () => {
        throw new Error('boom');
      },
      retry: false,
    })
    .catch(() => undefined);
  // Loaded once, then a refresh failed (offline): still has its last data.
  await queryClient.prefetchQuery({ queryKey: ['stale'], queryFn: async () => 'last known' });
  await queryClient
    .fetchQuery({
      queryKey: ['stale'],
      queryFn: async () => {
        throw new Error('Network request failed');
      },
      retry: false,
    })
    .catch(() => undefined);
  return queryClient;
}

describe('query cache persistence', () => {
  it('restores every query with data after a restart, skipping opted-out and empty ones', async () => {
    const storage = createMemoryStorage();
    const options = createPersistOptions(storage, { throttleTimeMs: 0 });

    await persistQueryClientSave({ queryClient: await seededClient(), ...options });
    await new Promise((done) => setTimeout(done, 10));
    expect(storage.items.has(QUERY_CACHE_KEY)).toBe(true);

    const restarted = testClient();
    await persistQueryClientRestore({ queryClient: restarted, ...options });

    expect(restarted.getQueryData(['summary'])).toEqual({ balance: 1_071_75 });
    expect(restarted.getQueryData(['private'])).toBeUndefined();
    expect(restarted.getQueryState(['broken'])).toBeUndefined();
    // A failed refresh must not erase what the user could see offline.
    expect(restarted.getQueryData(['stale'])).toBe('last known');
  });

  it('discards a cache written with another contract version', async () => {
    const storage = createMemoryStorage();
    const old = createPersistOptions(storage, { throttleTimeMs: 0 });
    await persistQueryClientSave({
      queryClient: await seededClient(),
      ...old,
      buster: 'contracts-v0',
    });
    await new Promise((done) => setTimeout(done, 10));

    const restarted = testClient();
    await persistQueryClientRestore({
      queryClient: restarted,
      ...createPersistOptions(storage, { throttleTimeMs: 0 }),
    });

    expect(QUERY_CACHE_BUSTER).not.toBe('contracts-v0');
    expect(restarted.getQueryData(['summary'])).toBeUndefined();
  });

  it('is wiped on sign-out', () => {
    const storage = createMemoryStorage();
    storage.setItem(QUERY_CACHE_KEY, '{}');

    clearPersistedQueryCache(storage);

    expect(storage.items.size).toBe(0);
  });
});
