import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

import { expoBiometrics } from '../biometrics';
import { expoSecureStorage } from '../expoSecureStorage';

jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  getItemAsync: jest.fn(async () => 'value'),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  authenticateAsync: jest.fn(),
}));

const mocked = jest.mocked;

describe('expoSecureStorage', () => {
  it('keeps secrets on this device only, readable while unlocked', async () => {
    await expoSecureStorage.setItem('k', 'v');
    await expect(expoSecureStorage.getItem('k')).resolves.toBe('value');
    await expoSecureStorage.deleteItem('k');

    const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('k', 'v', options);
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith('k', options);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('k', options);
  });
});

describe('expoBiometrics', () => {
  it('is available only with hardware and an enrolled biometric', async () => {
    mocked(LocalAuthentication.hasHardwareAsync).mockResolvedValue(true);
    mocked(LocalAuthentication.isEnrolledAsync).mockResolvedValue(false);
    await expect(expoBiometrics.isAvailable()).resolves.toBe(false);

    mocked(LocalAuthentication.isEnrolledAsync).mockResolvedValue(true);
    await expect(expoBiometrics.isAvailable()).resolves.toBe(true);
  });

  it('reports success only when the user passes the check', async () => {
    mocked(LocalAuthentication.authenticateAsync).mockResolvedValueOnce({ success: true });
    await expect(expoBiometrics.authenticate('Desbloquea iCount')).resolves.toBe(true);

    mocked(LocalAuthentication.authenticateAsync).mockResolvedValueOnce({
      success: false,
      error: 'user_cancel',
    });
    await expect(expoBiometrics.authenticate('Desbloquea iCount')).resolves.toBe(false);
    expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ promptMessage: 'Desbloquea iCount', cancelLabel: 'Cancelar' }),
    );
  });
});
