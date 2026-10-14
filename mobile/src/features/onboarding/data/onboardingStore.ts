import AsyncStorage from '@react-native-async-storage/async-storage';
import { createStore, useStore } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

import { hydrationTracker } from '@/shared/state/persistedStore';

export interface OnboardingState {
  /** Persisted: the user has seen (or skipped) the intro. */
  readonly onboardingCompleted: boolean;
  /** Not persisted: false until AsyncStorage has been read, so the UI never flashes the intro. */
  readonly hydrated: boolean;
  complete: () => void;
  /** For "show the intro again" in settings and for tests. */
  reset: () => void;
}

export const ONBOARDING_STORAGE_KEY = 'icount.onboarding';

/**
 * Client state (ADR-0006): Zustand store persisted with the storage you pass in.
 * Kotlin analogy: a DataStore<Preferences> exposed as a Flow; SwiftUI: @AppStorage.
 */
export function createOnboardingStore(storage: StateStorage) {
  const hydration = hydrationTracker();
  const store = createStore<OnboardingState>()(
    persist(
      (set) => ({
        onboardingCompleted: false,
        hydrated: false,
        complete: () => set({ onboardingCompleted: true }),
        reset: () => set({ onboardingCompleted: false }),
      }),
      {
        name: ONBOARDING_STORAGE_KEY,
        version: 1,
        storage: createJSONStorage(() => storage),
        partialize: (state) => ({ onboardingCompleted: state.onboardingCompleted }),
        onRehydrateStorage: () => (_state, error) => {
          if (error) hydration.readFailed();
        },
      },
    ),
  );
  hydration.attach(store);
  return store;
}

export const onboardingStore = createOnboardingStore(AsyncStorage);

/** Hook for components: `useOnboardingStore((s) => s.onboardingCompleted)`. */
export function useOnboardingStore<T>(selector: (state: OnboardingState) => T): T {
  return useStore(onboardingStore, selector);
}
