import AsyncStorage from '@react-native-async-storage/async-storage';
import { createStore, useStore } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

import { hydrationTracker } from '@/shared/state/persistedStore';

export interface RemindersPreferenceState {
  /** Persisted: the person asked to be reminded the day before a payment. */
  readonly enabled: boolean;
  /** Not persisted: false until AsyncStorage has been read. */
  readonly hydrated: boolean;
  setEnabled: (enabled: boolean) => void;
}

export const REMINDERS_STORAGE_KEY = 'icount.recurring.reminders';

/**
 * Client state (ADR-0006): whether local reminders are on. The OS permission is a separate fact
 * (the person can revoke it in Settings), so it is checked each time reminders are synced.
 */
export function createRemindersPreferenceStore(storage: StateStorage) {
  const hydration = hydrationTracker();
  const store = createStore<RemindersPreferenceState>()(
    persist(
      (set) => ({
        enabled: false,
        hydrated: false,
        setEnabled: (enabled) => set({ enabled }),
      }),
      {
        name: REMINDERS_STORAGE_KEY,
        version: 1,
        storage: createJSONStorage(() => storage),
        partialize: (state) => ({ enabled: state.enabled }),
        onRehydrateStorage: () => (_state, error) => {
          if (error) hydration.readFailed();
        },
      },
    ),
  );
  hydration.attach(store);
  return store;
}

export const remindersPreferenceStore = createRemindersPreferenceStore(AsyncStorage);

export function useRemindersPreference<T>(selector: (state: RemindersPreferenceState) => T): T {
  return useStore(remindersPreferenceStore, selector);
}
