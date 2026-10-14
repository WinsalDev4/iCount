import { useCallback, useState } from 'react';

import { useDependencies } from '@/core/di/DependenciesProvider';

import { isValidEmail } from '../domain/email';
import { authErrorMessage } from './authMessages';

export type SignInUiState =
  | { readonly status: 'idle'; readonly email: string; readonly canSubmit: boolean }
  | { readonly status: 'sending'; readonly email: string; readonly canSubmit: false }
  | {
      readonly status: 'error';
      readonly email: string;
      readonly message: string;
      readonly canSubmit: boolean;
    };

/**
 * ViewModel of the email screen. `submit()` resolves with the normalized email when the link
 * was requested (the View then navigates) and with `null` when it failed (state shows why).
 */
export function useSignInViewModel() {
  const { requestMagicLink } = useDependencies().auth;
  const [email, setEmailState] = useState('');
  const [phase, setPhase] = useState<
    { status: 'idle' } | { status: 'sending' } | { status: 'error'; message: string }
  >({ status: 'idle' });

  const setEmail = useCallback((value: string) => {
    setEmailState(value);
    // Typing again clears the previous error: it is about the old text.
    setPhase((current) => (current.status === 'error' ? { status: 'idle' } : current));
  }, []);

  const submit = useCallback(async (): Promise<string | null> => {
    setPhase({ status: 'sending' });
    try {
      const sentTo = await requestMagicLink.execute(email);
      setPhase({ status: 'idle' });
      return sentTo;
    } catch (error) {
      setPhase({ status: 'error', message: authErrorMessage(error) });
      return null;
    }
  }, [email, requestMagicLink]);

  const canSubmit = isValidEmail(email);
  const state: SignInUiState =
    phase.status === 'sending'
      ? { status: 'sending', email, canSubmit: false }
      : phase.status === 'error'
        ? { status: 'error', email, message: phase.message, canSubmit }
        : { status: 'idle', email, canSubmit };

  return { state, setEmail, submit };
}
