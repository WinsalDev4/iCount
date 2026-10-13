import * as SecureStore from 'expo-secure-store';

import type { SecureKeyValueStorage } from './SessionStore';

/**
 * Keychain (iOS) / Keystore-encrypted storage (Android). `WHEN_UNLOCKED_THIS_DEVICE_ONLY`:
 * readable only while the phone is unlocked and never restored onto another
 * device from a backup, so a refresh token stays bound to this device.
 */
const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export const expoSecureStorage: SecureKeyValueStorage = {
  getItem: (key) => SecureStore.getItemAsync(key, options),
  setItem: (key, value) => SecureStore.setItemAsync(key, value, options),
  deleteItem: (key) => SecureStore.deleteItemAsync(key, options),
};
