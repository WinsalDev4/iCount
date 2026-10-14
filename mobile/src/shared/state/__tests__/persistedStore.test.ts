import { hydrationTracker, type HydratableStore } from '../persistedStore';

function fakeStore(initiallyHydrated: boolean) {
  const listeners: (() => void)[] = [];
  const store: HydratableStore & { hydrated: boolean; finish: () => void } = {
    hydrated: false,
    setState(partial) {
      this.hydrated = partial.hydrated;
    },
    persist: {
      hasHydrated: () => initiallyHydrated,
      onFinishHydration: (listener) => {
        listeners.push(listener);
        return () => undefined;
      },
    },
    finish: () => listeners.forEach((listener) => listener()),
  };
  return store;
}

const flush = () => new Promise<void>((resolve) => queueMicrotask(resolve));

describe('hydrationTracker', () => {
  it('marks the store hydrated right away if the first read already finished (sync storage)', () => {
    const store = fakeStore(true);
    hydrationTracker().attach(store);
    expect(store.hydrated).toBe(true);
  });

  it('waits for the first read to finish (async storage)', () => {
    const store = fakeStore(false);
    hydrationTracker().attach(store);
    expect(store.hydrated).toBe(false);
    store.finish();
    expect(store.hydrated).toBe(true);
  });

  it('unblocks the UI when the read fails', async () => {
    const store = fakeStore(false);
    const tracker = hydrationTracker();
    tracker.attach(store);
    tracker.readFailed();
    await flush();
    expect(store.hydrated).toBe(true);
  });

  it('a failure reported before the store is attached still ends up hydrated', async () => {
    const store = fakeStore(false);
    const tracker = hydrationTracker();
    tracker.readFailed(); // sync storage can fail while the store is still being created
    tracker.attach(store);
    await flush();
    expect(store.hydrated).toBe(true);
  });
});
