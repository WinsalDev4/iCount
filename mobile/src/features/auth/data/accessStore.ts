import { createStore, useStore } from 'zustand';

export interface AccessState {
  /** The biometric unlock was passed during this app run (a fresh sign-in counts). */
  readonly unlocked: boolean;
  unlock: () => void;
  lock: () => void;
}

/** Deliberately NOT persisted: every cold start of the app begins locked. */
export const accessStore = createStore<AccessState>()((set) => ({
  unlocked: false,
  unlock: () => set({ unlocked: true }),
  lock: () => set({ unlocked: false }),
}));

export function useAccessStore<T>(selector: (state: AccessState) => T): T {
  return useStore(accessStore, selector);
}
