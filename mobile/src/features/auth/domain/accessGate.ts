/**
 * Which part of the app the user may see. One pure function decides it, so the root layout
 * only maps the phase to route guards:
 *
 *   loading → onboarding → signed-out → locked → offer-biometrics → ready
 */
export type AccessPhase =
  'loading' | 'onboarding' | 'signed-out' | 'locked' | 'offer-biometrics' | 'ready';

export interface AccessInputs {
  /** Persisted flags, the stored session and the device check are still being read. */
  readonly loading: boolean;
  readonly onboardingCompleted: boolean;
  readonly signedIn: boolean;
  /** The user opted into the local biometric unlock (ADR-0013). */
  readonly biometricsEnabled: boolean;
  /** The unlock was passed in this app run (a fresh sign-in counts). */
  readonly unlocked: boolean;
  /** The one-time opt-in is due: the device supports it and the user was not asked yet. */
  readonly offerBiometrics: boolean;
}

export function resolveAccess(input: AccessInputs): AccessPhase {
  if (input.loading) return 'loading';
  if (!input.onboardingCompleted) return 'onboarding';
  if (!input.signedIn) return 'signed-out';
  if (input.biometricsEnabled && !input.unlocked) return 'locked';
  if (input.offerBiometrics && !input.biometricsEnabled) return 'offer-biometrics';
  return 'ready';
}
