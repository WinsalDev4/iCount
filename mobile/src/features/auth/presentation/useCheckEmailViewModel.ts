import { useCallback, useEffect, useState } from 'react';

import { useDependencies } from '@/core/di/DependenciesProvider';

import { authErrorMessage } from './authMessages';

/** Seconds before the link can be requested again (the backend also rate-limits it). */
export const RESEND_COOLDOWN_SECONDS = 30;

export interface CheckEmailUiState {
  readonly email: string;
  readonly secondsLeft: number;
  readonly canResend: boolean;
  readonly sending: boolean;
  /** A new link was sent and the cooldown restarted. */
  readonly resent: boolean;
  readonly error: string | null;
}

/** ViewModel of "Revisa tu correo": a resend button with a countdown. */
export function useCheckEmailViewModel(email: string) {
  const { requestMagicLink } = useDependencies().auth;
  const [secondsLeft, setSecondsLeft] = useState(RESEND_COOLDOWN_SECONDS);
  const [sending, setSending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1_000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const resend = useCallback(async () => {
    setSending(true);
    setError(null);
    try {
      await requestMagicLink.execute(email);
      setResent(true);
      setSecondsLeft(RESEND_COOLDOWN_SECONDS);
    } catch (e) {
      setResent(false);
      setError(authErrorMessage(e));
    } finally {
      setSending(false);
    }
  }, [email, requestMagicLink]);

  const state: CheckEmailUiState = {
    email,
    secondsLeft,
    canResend: secondsLeft <= 0 && !sending,
    sending,
    resent,
    error,
  };
  return { state, resend };
}
