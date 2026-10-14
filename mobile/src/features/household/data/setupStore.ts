import { createStore, useStore } from 'zustand';

import type { HouseholdId } from '@/core/domain/Ids';

export interface SetupState {
  /**
   * A shared household was just created and its setup (invite, split rule) is not finished.
   * While set, the access gate keeps the user in the setup screens even though the household
   * already exists. Not persisted: if the app is killed halfway the household is simply there.
   */
  readonly pendingHouseholdId: HouseholdId | null;
  begin: (householdId: HouseholdId) => void;
  finish: () => void;
}

export const setupStore = createStore<SetupState>()((set) => ({
  pendingHouseholdId: null,
  begin: (householdId) => set({ pendingHouseholdId: householdId }),
  finish: () => set({ pendingHouseholdId: null }),
}));

export function useSetupStore<T>(selector: (state: SetupState) => T): T {
  return useStore(setupStore, selector);
}
