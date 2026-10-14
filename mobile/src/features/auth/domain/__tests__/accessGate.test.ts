import { resolveAccess, type AccessInputs } from '../accessGate';

const base: AccessInputs = {
  loading: false,
  onboardingCompleted: true,
  signedIn: true,
  biometricsEnabled: false,
  unlocked: false,
  offerBiometrics: false,
  needsHousehold: false,
};

describe('resolveAccess', () => {
  it('waits while anything is still being read', () => {
    expect(resolveAccess({ ...base, loading: true })).toBe('loading');
    // Even if the other flags already say "ready": never flash the wrong screen.
    expect(resolveAccess({ ...base, loading: true, onboardingCompleted: false })).toBe('loading');
  });

  it('starts with the onboarding for a first-time user', () => {
    expect(resolveAccess({ ...base, onboardingCompleted: false, signedIn: false })).toBe(
      'onboarding',
    );
  });

  it('shows the onboarding before asking to sign in', () => {
    expect(resolveAccess({ ...base, onboardingCompleted: false, signedIn: true })).toBe(
      'onboarding',
    );
  });

  it('asks a signed-out user to sign in', () => {
    expect(resolveAccess({ ...base, signedIn: false })).toBe('signed-out');
  });

  it('locks a stored session when biometrics are on and the unlock is pending', () => {
    expect(resolveAccess({ ...base, biometricsEnabled: true, unlocked: false })).toBe('locked');
  });

  it('opens the app once unlocked', () => {
    expect(resolveAccess({ ...base, biometricsEnabled: true, unlocked: true })).toBe('ready');
  });

  it('does not lock when biometrics are off', () => {
    expect(resolveAccess({ ...base, biometricsEnabled: false, unlocked: false })).toBe('ready');
  });

  it('offers the biometric opt-in once, before the app', () => {
    expect(resolveAccess({ ...base, offerBiometrics: true })).toBe('offer-biometrics');
  });

  it('does not offer what is already enabled', () => {
    expect(
      resolveAccess({ ...base, offerBiometrics: true, biometricsEnabled: true, unlocked: true }),
    ).toBe('ready');
  });

  it('sends a signed-in user without a household to the setup', () => {
    expect(resolveAccess({ ...base, needsHousehold: true })).toBe('setup');
  });

  it('keeps the user in the setup while a shared household is being finished', () => {
    // The household exists already; "needsHousehold" stays true until the wizard ends.
    expect(resolveAccess({ ...base, needsHousehold: true, biometricsEnabled: false })).toBe(
      'setup',
    );
  });

  it('asks for the biometric lock and offer before the household setup', () => {
    expect(
      resolveAccess({ ...base, needsHousehold: true, biometricsEnabled: true, unlocked: false }),
    ).toBe('locked');
    expect(resolveAccess({ ...base, needsHousehold: true, offerBiometrics: true })).toBe(
      'offer-biometrics',
    );
  });

  it('never shows the setup to a signed-out user', () => {
    expect(resolveAccess({ ...base, signedIn: false, needsHousehold: true })).toBe('signed-out');
  });

  it('never offers biometrics to a signed-out user', () => {
    expect(resolveAccess({ ...base, signedIn: false, offerBiometrics: true })).toBe('signed-out');
  });
});
