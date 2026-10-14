import { createMMKV, type MMKV } from 'react-native-mmkv';

import type { SyncKeyValueStorage } from './keyValueStorage';

/**
 * MMKV (ADR-0014): memory-mapped key-value store, synchronous and very fast, so
 * the persisted query cache is rehydrated before the first render.
 * Android/iOS analogy: a much faster SharedPreferences / UserDefaults.
 */
export function createMmkvStorage(id: string): SyncKeyValueStorage {
  // Lazily created so importing this module never touches native code (tests, web).
  let instance: MMKV | null = null;
  const mmkv = () => (instance ??= createMMKV({ id }));

  return {
    getItem: (key) => mmkv().getString(key) ?? null,
    setItem: (key, value) => mmkv().set(key, value),
    removeItem: (key) => void mmkv().remove(key),
  };
}

/** Instance that holds the persisted TanStack Query cache. */
export const queryCacheStorage = createMmkvStorage('icount.query-cache');
