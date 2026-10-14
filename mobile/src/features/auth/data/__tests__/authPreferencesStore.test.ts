import type { StateStorage } from 'zustand/middleware';

import { AUTH_PREFERENCES_KEY, createAuthPreferencesStore } from '../authPreferencesStore';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

function memoryStorage(): StateStorage & { data: Record<string, string> } {
  const data: Record<string, string> = {};
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

describe('authPreferencesStore', () => {
  it('starts with biometrics off and not prompted, hydrated from empty storage', async () => {
    const store = createAuthPreferencesStore(memoryStorage());
    await flush();
    expect(store.getState()).toMatchObject({
      biometricsEnabled: false,
      biometricsPrompted: false,
      hydrated: true,
    });
  });

  it('persists both preferences but not the transient flag', async () => {
    const storage = memoryStorage();
    const store = createAuthPreferencesStore(storage);
    store.getState().setBiometricsEnabled(true);
    store.getState().markBiometricsPrompted();
    await flush();
    const saved = JSON.parse(storage.data[AUTH_PREFERENCES_KEY] ?? '{}').state;
    expect(saved).toEqual({ biometricsEnabled: true, biometricsPrompted: true });
  });

  it('restores them after a restart', async () => {
    const storage = memoryStorage();
    createAuthPreferencesStore(storage).getState().setBiometricsEnabled(true);
    await flush();
    const restarted = createAuthPreferencesStore(storage);
    await flush();
    expect(restarted.getState().biometricsEnabled).toBe(true);
  });

  it('can turn biometrics off again', async () => {
    const store = createAuthPreferencesStore(memoryStorage());
    store.getState().setBiometricsEnabled(true);
    store.getState().setBiometricsEnabled(false);
    expect(store.getState().biometricsEnabled).toBe(false);
  });

  it('still opens the app with defaults when reading storage fails', async () => {
    const broken: StateStorage = {
      getItem: () => Promise.reject(new Error('disk error')),
      setItem: () => undefined,
      removeItem: () => undefined,
    };
    const store = createAuthPreferencesStore(broken);
    await flush();
    await flush();
    expect(store.getState()).toMatchObject({ hydrated: true, biometricsEnabled: false });
  });
});
