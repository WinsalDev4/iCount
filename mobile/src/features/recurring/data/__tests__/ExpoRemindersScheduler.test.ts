import * as Notifications from 'expo-notifications';

import { expoNotificationsGateway } from '@/core/notifications/expoNotificationsGateway';

import type { ReminderPlan } from '../../domain/RemindersScheduler';
import { ExpoRemindersScheduler, REMINDER_ID_PREFIX } from '../ExpoRemindersScheduler';

jest.mock('expo-notifications', () => ({
  SchedulableTriggerInputTypes: { DATE: 'date' },
  getAllScheduledNotificationsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(async () => 'id'),
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
}));
jest.mock('@/core/notifications/expoNotificationsGateway', () => ({
  expoNotificationsGateway: {
    getPermission: jest.fn(),
    requestPermission: jest.fn(),
    ensureDefaultChannel: jest.fn(async () => undefined),
  },
}));

const mocked = jest.mocked;
const plan = (id: string): ReminderPlan => ({
  id,
  fireAt: new Date(2026, 9, 19, 9),
  title: 'Mañana vence un pago',
  body: 'Alquiler: 750,00 €',
  url: '/recurring',
});

beforeEach(() => jest.clearAllMocks());

describe('ExpoRemindersScheduler', () => {
  it('asks the OS only through the shared gateway (and creates the Android channel first)', async () => {
    mocked(expoNotificationsGateway.getPermission).mockResolvedValue('undetermined');
    mocked(expoNotificationsGateway.requestPermission).mockResolvedValue('granted');
    const scheduler = new ExpoRemindersScheduler();

    expect(await scheduler.permission()).toBe('undetermined');
    expect(await scheduler.requestPermission()).toBe('granted');
    expect(expoNotificationsGateway.ensureDefaultChannel).toHaveBeenCalledTimes(1);
  });

  it('replaces only its own reminders, then schedules each plan on its date', async () => {
    mocked(Notifications.getAllScheduledNotificationsAsync).mockResolvedValue([
      { identifier: `${REMINDER_ID_PREFIX}old` },
      { identifier: 'push-or-something-else' },
    ] as Notifications.NotificationRequest[]);

    await new ExpoRemindersScheduler().replaceAll([plan('a:2026-10-20'), plan('b:2026-10-20')]);

    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      `${REMINDER_ID_PREFIX}old`,
    );
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
      identifier: `${REMINDER_ID_PREFIX}a:2026-10-20`,
      content: {
        title: 'Mañana vence un pago',
        body: 'Alquiler: 750,00 €',
        data: { event: 'recurring-reminder', url: '/recurring' },
      },
      trigger: { type: 'date', date: new Date(2026, 9, 19, 9), channelId: 'default' },
    });
  });

  it('cancelAll leaves other notifications alone', async () => {
    mocked(Notifications.getAllScheduledNotificationsAsync).mockResolvedValue([
      { identifier: `${REMINDER_ID_PREFIX}x` },
      { identifier: 'other' },
    ] as Notifications.NotificationRequest[]);
    await new ExpoRemindersScheduler().cancelAll();
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});
