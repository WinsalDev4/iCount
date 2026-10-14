import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { useDependencies } from '@/core/di/DependenciesProvider';

import { authErrorMessage } from './authMessages';
import { startSession } from './session';

export type VerifyUiState =
  { readonly status: 'verifying' } | { readonly status: 'error'; readonly message: string };

/**
 * ViewModel of the deep link `icount://auth/verify?token=…`. It verifies once per token and
 * stores the session; there is no "success" state on purpose: storing the session changes the
 * access phase, and the router then moves the user out of this route by itself
 * (to the app, or to the one-time biometric offer).
 */
export function useVerifyViewModel(token: string | undefined) {
  const { verifyMagicLink } = useDependencies().auth;
  const queryClient = useQueryClient();
  const [state, setState] = useState<VerifyUiState>({ status: 'verifying' });
  // A magic link is single-use: Strict Mode's double effect or a re-render must not spend it twice.
  const startedFor = useRef<{ token: string | undefined } | null>(null);

  useEffect(() => {
    if (startedFor.current !== null && startedFor.current.token === token) return;
    startedFor.current = { token };

    (async () => {
      try {
        const session = await verifyMagicLink.execute(token);
        await startSession(queryClient, session);
      } catch (error) {
        setState({ status: 'error', message: authErrorMessage(error) });
      }
    })();
  }, [token, verifyMagicLink, queryClient]);

  return { state };
}
