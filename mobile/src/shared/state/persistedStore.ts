/**
 * Helper for Zustand stores persisted with `persist`, each carrying a transient
 * `hydrated: boolean` (never written to disk) so the UI can wait for the first read.
 *
 * Two traps it hides: storage can be sync (tests) or async (AsyncStorage), and zustand does
 * not signal "hydrated" when the read fails, which would leave the UI waiting forever.
 * On a failed read we start from the defaults instead of blocking the app.
 * Kotlin analogy: a DataStore<Preferences> that always emits a first value.
 *
 * Usage:
 *   const hydration = hydrationTracker();
 *   const store = createStore<S>()(persist(init, { …, onRehydrateStorage: () => (_s, error) => { if (error) hydration.readFailed(); } }));
 *   hydration.attach(store);
 */
export interface HydratableStore {
  setState(partial: { hydrated: boolean }): void;
  persist: {
    hasHydrated(): boolean;
    onFinishHydration(listener: () => void): () => void;
  };
}

export function hydrationTracker() {
  let target: HydratableStore | undefined;
  const markHydrated = () => target?.setState({ hydrated: true });

  return {
    /** Call it from `onRehydrateStorage` when the read failed: unblocks the UI with the defaults. */
    readFailed() {
      // Deferred: the store may not be attached yet if the storage is synchronous.
      queueMicrotask(markHydrated);
    },
    /** Marks the store hydrated once the first read finishes (now, if it already did). */
    attach(store: HydratableStore) {
      target = store;
      if (store.persist.hasHydrated()) markHydrated();
      else store.persist.onFinishHydration(markHydrated);
    },
  };
}
