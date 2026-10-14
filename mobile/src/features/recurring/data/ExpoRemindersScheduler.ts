import type { NotificationPermission } from '@/core/notifications/NotificationsGateway';

import type { RemindersScheduler, ReminderPlan } from '../domain/RemindersScheduler';

type ExpoNotifications = typeof import('expo-notifications');
type Gateway = typeof import('@/core/notifications/expoNotificationsGateway');

// Loaded on first use (a plain lazy `require`, which Metro and Jest both support), so building the
// DI container never pulls native code.
const notifications = (): ExpoNotifications =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('expo-notifications') as ExpoNotifications;
const gateway = () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  (require('@/core/notifications/expoNotificationsGateway') as Gateway).expoNotificationsGateway;

/** Identifier prefix: lets us replace our reminders without touching anybody else's. */
export const REMINDER_ID_PREFIX = 'recurring:';

/**
 * Adapter over expo-notifications (SDK 57) for local reminders. The modules are loaded on first
 * use: building the DI container then never pulls native code (tests, web), and it is only needed
 * once the person switches reminders on. The permission comes from the same gateway the push
 * registration uses, so both ask the OS in the same way.
 */
export class ExpoRemindersScheduler implements RemindersScheduler {
  async permission(): Promise<NotificationPermission> {
    return gateway().getPermission();
  }

  async requestPermission(): Promise<NotificationPermission> {
    // Android 13+ only shows the prompt once the channel exists.
    await gateway().ensureDefaultChannel();
    return gateway().requestPermission();
  }

  async replaceAll(plans: readonly ReminderPlan[]): Promise<void> {
    const Notifications = notifications();
    await this.cancelOurs(Notifications);
    for (const plan of plans) {
      await Notifications.scheduleNotificationAsync({
        identifier: `${REMINDER_ID_PREFIX}${plan.id}`,
        content: {
          title: plan.title,
          body: plan.body,
          data: { event: 'recurring-reminder', url: plan.url },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: plan.fireAt,
          channelId: 'default',
        },
      });
    }
  }

  async cancelAll(): Promise<void> {
    await this.cancelOurs(notifications());
  }

  private async cancelOurs(Notifications: ExpoNotifications): Promise<void> {
    const pending = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      pending
        .filter((request) => request.identifier.startsWith(REMINDER_ID_PREFIX))
        .map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier)),
    );
  }
}
