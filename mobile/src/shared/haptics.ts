import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Tiny wrapper over expo-haptics. Feedback is a nicety, never a requirement: it does nothing on
 * the web and swallows any error (a device without a vibration motor, a revoked permission…),
 * so a missing haptic can never break a screen.
 */
function run(effect: () => Promise<void>): void {
  if (Platform.OS === 'web') return;
  effect().catch(() => undefined);
}

/** A light tick, for keypad keys and toggles. */
export function tapHaptic(): void {
  run(() => Haptics.selectionAsync());
}

/** Something worked (a movement was saved). */
export function successHaptic(): void {
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

/** Something did not work. */
export function errorHaptic(): void {
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
}
