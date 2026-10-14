/**
 * Synchronous key-value storage (the shape TanStack's sync persister expects).
 * MMKV in the app, a Map in tests. Not for secrets: those go to SecureStore.
 */
export interface SyncKeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function createMemoryStorage(): SyncKeyValueStorage & {
  readonly items: Map<string, string>;
} {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
  };
}
