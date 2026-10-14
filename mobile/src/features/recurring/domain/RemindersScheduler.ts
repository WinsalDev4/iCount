import type { NotificationPermission } from '@/core/notifications/NotificationsGateway';

/** One local notification: "tomorrow «Alquiler» is due". */
export interface ReminderPlan {
  /** Stable (`<payment id>:<due date>`) so a re-sync replaces instead of duplicating. */
  readonly id: string;
  readonly fireAt: Date;
  readonly title: string;
  readonly body: string;
  /** Expo Router path opened when the notification is tapped. */
  readonly url: string;
}

/**
 * Local reminders of the recurring payments, as a port so the logic is testable without native
 * modules. Android analogy: AlarmManager + NotificationManagerCompat; iOS: UNUserNotificationCenter
 * with calendar triggers. Nothing here talks to a server.
 */
export interface RemindersScheduler {
  permission(): Promise<NotificationPermission>;
  /** Shows the OS prompt (only when it can still be shown). Call it in context, never at launch. */
  requestPermission(): Promise<NotificationPermission>;
  /** Makes the scheduled reminders exactly `plans`: the ones of this feature, no others. */
  replaceAll(plans: readonly ReminderPlan[]): Promise<void>;
  cancelAll(): Promise<void>;
}
