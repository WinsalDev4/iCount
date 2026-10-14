import AsyncStorage from '@react-native-async-storage/async-storage';
import { createStore, useStore } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

import { hydrationTracker } from '@/shared/state/persistedStore';

export interface AuthPreferencesState {
  /** Persisted: ask for Face ID / fingerprint when the app opens with a stored session. */
  readonly biometricsEnabled: boolean;
  /** Persisted: the opt-in screen was already shown once, so we do not nag. */
  readonly biometricsPrompted: boolean;
  /** Not persisted: false until the first read of the storage ends. */
  readonly hydrated: boolean;
  setBiometricsEnabled: (enabled: boolean) => void;
  markBiometricsPrompted: () => void;
}

export const AUTH_PREFERENCES_KEY = 'icount.auth.preferences';

/** Local device preferences (ADR-0006: client state in Zustand). The server never sees them. */
export function createAuthPreferencesStore(storage: StateStorage) {
  const hydration = hydrationTracker();
  const store = createStore<AuthPreferencesState>()(
    persist(
      (set) => ({
        biometricsEnabled: false,
        biometricsPrompted: false,
        hydrated: false,
        setBiometricsEnabled: (enabled) => set({ biometricsEnabled: enabled }),
        markBiometricsPrompted: () => set({ biometricsPrompted: true }),
      }),
      {
        name: AUTH_PREFERENCES_KEY,
        version: 1,
        storage: createJSONStorage(() => storage),
        partialize: (state) => ({
          biometricsEnabled: state.biometricsEnabled,
          biometricsPrompted: state.biometricsPrompted,
        }),
        onRehydrateStorage: () => (_state, error) => {
          if (error) hydration.readFailed();
        },
      },
    ),
  );
  hydration.attach(store);
  return store;
}

export const authPreferencesStore = createAuthPreferencesStore(AsyncStorage);

export function useAuthPreferences<T>(selector: (state: AuthPreferencesState) => T): T {
  return useStore(authPreferencesStore, selector);
}
