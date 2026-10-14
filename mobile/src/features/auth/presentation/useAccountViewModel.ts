import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { useDependencies } from '@/core/di/DependenciesProvider';

import { endSession, useSessionQuery } from './session';

/** Who is signed in and the sign-out action (shown in the account card). */
export function useAccountViewModel() {
  const { signOut } = useDependencies().auth;
  const queryClient = useQueryClient();
  const session = useSessionQuery();
  const [signingOut, setSigningOut] = useState(false);

  const leave = useCallback(async () => {
    setSigningOut(true);
    try {
      await signOut.execute();
    } catch {
      // Revoking on the server is best effort: this device forgets the session either way.
    } finally {
      // Even if the server could not be told, this device must forget the session.
      endSession(queryClient);
      setSigningOut(false);
    }
  }, [signOut, queryClient]);

  return {
    state: { email: session.data?.user.email ?? '', signingOut },
    signOut: leave,
  };
}
