import type { StateStorage } from 'zustand/middleware';

import { createRemindersPreferenceStore, REMINDERS_STORAGE_KEY } from '../remindersPreferenceStore';

// The module under test imports AsyncStorage for its default instance; this keeps it off native code.
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

function memoryStorage(initial: Record<string, string> = {}): StateStorage & {
  data: Record<string, string>;
} {
  const data = { ...initial };
  return {
    data,
    getItem: (name) => data[name] ?? null,
    setItem: (name, value) => {
      data[name] = value;
    },
    removeItem: (name) => {
      delete data[name];
    },
  };
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('remindersPreferenceStore', () => {
  it('starts off and hydrated when storage is empty', async () => {
    const store = createRemindersPreferenceStore(memoryStorage());
    await flush();
    expect(store.getState().enabled).toBe(false);
    expect(store.getState().hydrated).toBe(true);
  });

  it('persists the choice but never the hydration flag', async () => {
    const storage = memoryStorage();
    const store = createRemindersPreferenceStore(storage);
    store.getState().setEnabled(true);
    await flush();
    const saved = JSON.parse(storage.data[REMINDERS_STORAGE_KEY] ?? '{}') as {
      state: Record<string, unknown>;
    };
    expect(saved.state).toEqual({ enabled: true });
  });

  it('restores the choice on the next start', async () => {
    const storage = memoryStorage();
    createRemindersPreferenceStore(storage).getState().setEnabled(true);
    await flush();
    const again = createRemindersPreferenceStore(storage);
    await flush();
    expect(again.getState().enabled).toBe(true);
  });

  it('starts from the defaults when the read fails', async () => {
    const broken: StateStorage = {
      getItem: () => {
        throw new Error('disk');
      },
      setItem: () => undefined,
      removeItem: () => undefined,
    };
    const store = createRemindersPreferenceStore(broken);
    await flush();
    expect(store.getState().hydrated).toBe(true);
    expect(store.getState().enabled).toBe(false);
  });
});
