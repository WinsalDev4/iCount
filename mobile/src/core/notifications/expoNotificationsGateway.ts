import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { NotificationPermission, NotificationsGateway } from './NotificationsGateway';

/** Channel the backend targets (`channelId: 'default'` in ExpoPushSender). */
export const DEFAULT_CHANNEL_ID = 'default';

function toPermission(response: Notifications.NotificationPermissionsStatus) {
  // iOS: "provisional" (quiet delivery) also lets notifications in.
  if (
    response.granted ||
    response.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  ) {
    return 'granted';
  }
  return response.canAskAgain ? 'undetermined' : 'denied';
}

function readProjectId(): string | null {
  const fromConfig = Constants.expoConfig?.extra?.eas?.projectId as unknown;
  const projectId = typeof fromConfig === 'string' ? fromConfig : Constants.easConfig?.projectId;
  return projectId ?? null;
}

/** Adapter over expo-notifications / expo-device / expo-constants (SDK 57). */
export const expoNotificationsGateway: NotificationsGateway = {
  isPhysicalDevice: Device.isDevice,
  platform: Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'other',
  deviceName: Device.deviceName,
  projectId: readProjectId(),

  async ensureDefaultChannel() {
    if (Platform.OS !== 'android') return;
    await Notifications.setNotificationChannelAsync(DEFAULT_CHANNEL_ID, {
      name: 'Avisos del hogar',
      importance: Notifications.AndroidImportance.HIGH,
    });
  },

  async getPermission(): Promise<NotificationPermission> {
    return toPermission(await Notifications.getPermissionsAsync());
  },

  async requestPermission(): Promise<NotificationPermission> {
    return toPermission(
      await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: false, allowSound: true },
      }),
    );
  },

  async getExpoPushToken(projectId) {
    return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  },
};

/**
 * How notifications that arrive while the app is open are shown: banner and
 * list, with sound, no badge. Call once at startup (module scope of the root layout).
 */
export function configureForegroundNotifications(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}
