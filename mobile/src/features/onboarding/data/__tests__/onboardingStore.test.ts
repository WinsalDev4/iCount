import type { StateStorage } from 'zustand/middleware';

import { createOnboardingStore, ONBOARDING_STORAGE_KEY } from '../onboardingStore';

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

describe('onboardingStore', () => {
  it('starts not completed and hydrated when storage is empty', async () => {
    const store = createOnboardingStore(memoryStorage());
    await flush();
    expect(store.getState().onboardingCompleted).toBe(false);
    expect(store.getState().hydrated).toBe(true);
  });

  it('persists completion', async () => {
    const storage = memoryStorage();
    const store = createOnboardingStore(storage);
    store.getState().complete();
    await flush();
    expect(JSON.parse(storage.data[ONBOARDING_STORAGE_KEY] ?? '{}').state).toEqual({
      onboardingCompleted: true,
    });
  });

  it('restores completion in a new store (app restart)', async () => {
    const storage = memoryStorage();
    createOnboardingStore(storage).getState().complete();
    await flush();

    const restarted = createOnboardingStore(storage);
    await flush();
    expect(restarted.getState().onboardingCompleted).toBe(true);
    expect(restarted.getState().hydrated).toBe(true);
  });

  it('does not persist the transient hydrated flag', async () => {
    const storage = memoryStorage();
    createOnboardingStore(storage).getState().complete();
    await flush();
    expect(storage.data[ONBOARDING_STORAGE_KEY]).not.toContain('hydrated');
  });

  it('reset shows the intro again', async () => {
    const store = createOnboardingStore(memoryStorage());
    store.getState().complete();
    store.getState().reset();
    expect(store.getState().onboardingCompleted).toBe(false);
  });

  it('is hydrated asynchronously with an async storage', async () => {
    const slow: StateStorage = {
      getItem: () =>
        new Promise((resolve) =>
          setTimeout(
            () => resolve(JSON.stringify({ state: { onboardingCompleted: true }, version: 1 })),
            5,
          ),
        ),
      setItem: () => undefined,
      removeItem: () => undefined,
    };
    const store = createOnboardingStore(slow);
    expect(store.getState().hydrated).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(store.getState().hydrated).toBe(true);
    expect(store.getState().onboardingCompleted).toBe(true);
  });

  it('still opens the app (intro shown) when reading storage fails', async () => {
    const broken: StateStorage = {
      getItem: () => Promise.reject(new Error('disk error')),
      setItem: () => undefined,
      removeItem: () => undefined,
    };
    const store = createOnboardingStore(broken);
    await flush();
    await flush();
    expect(store.getState().hydrated).toBe(true);
    expect(store.getState().onboardingCompleted).toBe(false);
  });
});
