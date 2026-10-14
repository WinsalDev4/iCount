import * as Notifications from 'expo-notifications';

import {
  configureForegroundNotifications,
  DEFAULT_CHANNEL_ID,
  expoNotificationsGateway,
} from '../expoNotificationsGateway';

jest.mock('expo-notifications', () => ({
  AndroidImportance: { HIGH: 4 },
  IosAuthorizationStatus: { PROVISIONAL: 3 },
  setNotificationChannelAsync: jest.fn(async () => null),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(async () => ({ type: 'expo', data: 'ExponentPushToken[x]' })),
  setNotificationHandler: jest.fn(),
}));
jest.mock('expo-device', () => ({ isDevice: true, deviceName: 'Pixel 8a' }));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: 'eas-project' } } } },
}));

const mocked = jest.mocked;
const permission = (fields: Record<string, unknown>) =>
  fields as unknown as Notifications.NotificationPermissionsStatus;

describe('expoNotificationsGateway', () => {
  it('reads the device and the EAS project id', () => {
    expect(expoNotificationsGateway.isPhysicalDevice).toBe(true);
    expect(expoNotificationsGateway.deviceName).toBe('Pixel 8a');
    expect(expoNotificationsGateway.projectId).toBe('eas-project');
  });

  it('maps permissions: granted, provisional, can ask again, denied', async () => {
    mocked(Notifications.getPermissionsAsync)
      .mockResolvedValueOnce(permission({ granted: true, canAskAgain: true }))
      .mockResolvedValueOnce(permission({ granted: false, canAskAgain: true, ios: { status: 3 } }))
      .mockResolvedValueOnce(permission({ granted: false, canAskAgain: true }))
      .mockResolvedValueOnce(permission({ granted: false, canAskAgain: false }));

    const results = [];
    for (let i = 0; i < 4; i += 1) results.push(await expoNotificationsGateway.getPermission());

    expect(results).toEqual(['granted', 'granted', 'undetermined', 'denied']);
  });

  it('gets the Expo push token for the project', async () => {
    await expect(expoNotificationsGateway.getExpoPushToken('eas-project')).resolves.toBe(
      'ExponentPushToken[x]',
    );
    expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'eas-project' });
  });

  it('creates the channel the backend sends to (Android)', async () => {
    await expoNotificationsGateway.ensureDefaultChannel();
    // jest-expo runs as iOS by default: no channel there.
    expect(Notifications.setNotificationChannelAsync).not.toHaveBeenCalled();
    expect(DEFAULT_CHANNEL_ID).toBe('default');
  });

  it('shows notifications in the foreground as banner and list, without badge', async () => {
    configureForegroundNotifications();
    const handler = mocked(Notifications.setNotificationHandler).mock.calls[0]?.[0];

    await expect(handler?.handleNotification({} as Notifications.Notification)).resolves.toEqual({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    });
  });
});
