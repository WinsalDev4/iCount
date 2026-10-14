import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { errorHaptic, successHaptic, tapHaptic } from '../haptics';

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

const original = Platform.OS;
afterEach(() => {
  Platform.OS = original;
  jest.clearAllMocks();
});

describe('haptics', () => {
  it('ticks for taps and notifies success and error', () => {
    tapHaptic();
    successHaptic();
    errorHaptic();
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.notificationAsync).toHaveBeenNthCalledWith(1, 'success');
    expect(Haptics.notificationAsync).toHaveBeenNthCalledWith(2, 'error');
  });

  it('does nothing on the web', () => {
    Platform.OS = 'web';
    tapHaptic();
    successHaptic();
    expect(Haptics.selectionAsync).not.toHaveBeenCalled();
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  });

  it('swallows failures: a missing haptic motor must never break a screen', async () => {
    (Haptics.selectionAsync as jest.Mock).mockRejectedValueOnce(new Error('no motor'));
    expect(() => tapHaptic()).not.toThrow();
    await Promise.resolve();
  });
});
