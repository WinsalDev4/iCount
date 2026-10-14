import { useQuery } from '@tanstack/react-query';

import { useDependencies } from '@/core/di/DependenciesProvider';
import { useSetupStore } from '@/features/household/data/setupStore';
import { useMyHouseholds } from '@/features/household/presentation/households';
import { useOnboardingStore } from '@/features/onboarding/data/onboardingStore';

import { useAccessStore } from '../data/accessStore';
import { useAuthPreferences } from '../data/authPreferencesStore';
import { resolveAccess, type AccessPhase } from '../domain/accessGate';
import { useSessionQuery } from './session';

/** Does this device have a biometric enrolled? Asked once per app run. */
function useBiometricsAvailable() {
  const { biometrics } = useDependencies().auth;
  return useQuery({
    queryKey: ['biometrics', 'available'],
    queryFn: () => biometrics.isAvailable().catch(() => false),
    staleTime: Infinity,
    meta: { persist: false },
  });
}

/**
 * Where the app should be right now: the root layout maps this to route guards
 * (onboarding → sign-in → biometric lock → one-time opt-in → app). A failed session read
 * counts as signed out.
 */
export function useAccess(): { phase: AccessPhase } {
  const onboardingHydrated = useOnboardingStore((s) => s.hydrated);
  const onboardingCompleted = useOnboardingStore((s) => s.onboardingCompleted);
  const prefsHydrated = useAuthPreferences((s) => s.hydrated);
  const biometricsEnabled = useAuthPreferences((s) => s.biometricsEnabled);
  const biometricsPrompted = useAuthPreferences((s) => s.biometricsPrompted);
  const unlocked = useAccessStore((s) => s.unlocked);
  const session = useSessionQuery();
  const available = useBiometricsAvailable();
  const setupInProgress = useSetupStore((s) => s.pendingHouseholdId !== null);

  const signedIn = Boolean(session.data);
  const households = useMyHouseholds({ enabled: signedIn });
  const phase = resolveAccess({
    // The device check only matters once someone is signed in.
    loading:
      !onboardingHydrated ||
      !prefsHydrated ||
      session.isPending ||
      (signedIn && (available.isPending || households.isPending)),
    onboardingCompleted,
    signedIn,
    biometricsEnabled,
    unlocked,
    offerBiometrics: available.data === true && !biometricsPrompted,
    // An unreadable list (offline) must not push an existing user back into the setup: only an
    // answer that really says "none" does.
    needsHousehold: setupInProgress || (households.isSuccess && households.data.length === 0),
  });
  return { phase };
}
