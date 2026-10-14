import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { useDependencies } from '@/core/di/DependenciesProvider';

import { accessStore } from '../data/accessStore';
import { endSession } from './session';

export type LockUiState =
  { readonly status: 'idle' } | { readonly status: 'checking' } | { readonly status: 'failed' };

/** ViewModel of the lock screen shown on app start when the biometric unlock is on. */
export function useLockViewModel() {
  const { biometrics, signOut } = useDependencies().auth;
  const queryClient = useQueryClient();
  const [state, setState] = useState<LockUiState>({ status: 'idle' });

  const unlock = useCallback(async () => {
    setState({ status: 'checking' });
    try {
      if (await biometrics.authenticate('Desbloquea iCount')) {
        accessStore.getState().unlock();
        setState({ status: 'idle' });
        return;
      }
    } catch {
      // Treated as a failed attempt; the person can retry or sign out.
    }
    setState({ status: 'failed' });
  }, [biometrics]);

  /** The way out when biometrics stop working (lost finger, new phone settings…). */
  const leave = useCallback(async () => {
    try {
      await signOut.execute();
    } catch {
      // Revoking on the server is best effort: this device forgets the session either way.
    } finally {
      endSession(queryClient);
    }
  }, [signOut, queryClient]);

  return { state, unlock, signOut: leave };
}
