import { useCallback, useEffect, useState } from 'react';

import { useDependencies } from '@/core/di/DependenciesProvider';

import { authPreferencesStore, useAuthPreferences } from '../data/authPreferencesStore';

export interface BiometricsUiState {
  /** `null` while we ask the device. */
  readonly available: boolean | null;
  readonly enabled: boolean;
  readonly busy: boolean;
  readonly error: string | null;
}

/**
 * The biometric switch (ADR-0013): a LOCAL lock for the stored session. Turning it on asks the
 * user to pass the check once, so a switch that cannot work never stays on.
 */
export function useBiometricsViewModel() {
  const { biometrics } = useDependencies().auth;
  const enabled = useAuthPreferences((s) => s.biometricsEnabled);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    biometrics
      .isAvailable()
      .then((value) => alive && setAvailable(value))
      .catch(() => alive && setAvailable(false));
    return () => {
      alive = false;
    };
  }, [biometrics]);

  const setEnabled = useCallback(
    async (next: boolean) => {
      setError(null);
      if (!next) {
        authPreferencesStore.getState().setBiometricsEnabled(false);
        return;
      }
      setBusy(true);
      try {
        const passed = await biometrics.authenticate('Confirma para activar el desbloqueo');
        if (passed) authPreferencesStore.getState().setBiometricsEnabled(true);
        else setError('No hemos podido confirmar tu identidad. Inténtalo de nuevo.');
      } catch {
        setError('No se pudo usar la biometría en este dispositivo.');
      } finally {
        setBusy(false);
      }
    },
    [biometrics],
  );

  /** The opt-in screen was shown: do not offer it again. */
  const markPrompted = useCallback(() => {
    authPreferencesStore.getState().markBiometricsPrompted();
  }, []);

  const state: BiometricsUiState = { available, enabled, busy, error };
  return { state, setEnabled, markPrompted };
}
