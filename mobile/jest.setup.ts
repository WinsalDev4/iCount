/**
 * Native modules without a JS fallback, replaced for every test (Jest runs in Node).
 * A test can still `jest.mock` them again to assert on calls.
 */

// MMKV (persisted query cache): an in-memory store per id, emptied after every test so a
// cache written by one test never leaks into the next.
jest.mock('react-native-mmkv', () => {
  const stores = new Map<string, Map<string, string>>();
  return {
    __reset: () => stores.forEach((values) => values.clear()),
    createMMKV: ({ id }: { id: string }) => {
      const values = stores.get(id) ?? new Map<string, string>();
      stores.set(id, values);
      return {
        getString: (key: string) => values.get(key),
        set: (key: string, value: string) => void values.set(key, value),
        remove: (key: string) => values.delete(key),
      };
    },
  };
});

afterEach(() => {
  const mmkv = jest.requireMock<{ __reset?: () => void }>('react-native-mmkv');
  mmkv.__reset?.();
});
