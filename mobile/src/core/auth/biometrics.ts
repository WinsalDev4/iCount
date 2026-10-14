import * as LocalAuthentication from 'expo-local-authentication';

/**
 * Local unlock with Face ID / fingerprint (ADR-0013). It only gates the session
 * already stored on this device; the server never knows about it.
 * Android analogy: BiometricPrompt; iOS: LAContext.evaluatePolicy.
 */
export interface BiometricAuthenticator {
  /** Hardware present and at least one biometric enrolled. */
  isAvailable(): Promise<boolean>;
  /** True only if the user passed the check (cancel or failure → false). */
  authenticate(reason: string): Promise<boolean>;
}

export const expoBiometrics: BiometricAuthenticator = {
  async isAvailable() {
    const [hasHardware, isEnrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    return hasHardware && isEnrolled;
  },

  async authenticate(reason) {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      cancelLabel: 'Cancelar',
      // Falling back to the device passcode is fine: it proves the same person.
      disableDeviceFallback: false,
    });
    return result.success;
  },
};
