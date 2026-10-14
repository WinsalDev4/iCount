export type PushPlatform = 'ios' | 'android';

/** Notification permission as the OS reports it. `undetermined`: we can still ask. */
export type NotificationPermission = 'granted' | 'denied' | 'undetermined';

/**
 * What the app needs from the OS to receive push notifications (ADR-0017), as a
 * port so the registration logic is testable without native modules. Android
 * analogy: a wrapper over NotificationManagerCompat + FirebaseMessaging; iOS:
 * UNUserNotificationCenter + registerForRemoteNotifications.
 */
export interface NotificationsGateway {
  /** Push only works on real devices (emulators/simulators never get remote pushes). */
  readonly isPhysicalDevice: boolean;
  readonly platform: PushPlatform | 'other';
  /** e.g. "Pixel 8a", to list and revoke devices. */
  readonly deviceName: string | null;
  /** EAS project id; without it there is no Expo push token (`eas init`, task 6.0). */
  readonly projectId: string | null;
  /** Android 13+ only shows the permission prompt once a channel exists. */
  ensureDefaultChannel(): Promise<void>;
  getPermission(): Promise<NotificationPermission>;
  requestPermission(): Promise<NotificationPermission>;
  /** `ExponentPushToken[…]`. Needs network: it may reject offline. */
  getExpoPushToken(projectId: string): Promise<string>;
}
