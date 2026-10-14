import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';

import { routeFromNotificationData } from './notificationRoute';

/**
 * Opens the route of a tapped notification (Android analogy: the PendingIntent
 * of the notification; iOS: `userNotificationCenter(_:didReceive:)`). Covers both
 * a tap that launched the app (last response) and taps while it is running.
 * Use it once, in the root layout. `navigate` is usually `router.push`.
 */
export function useNotificationTaps(navigate: (route: string) => void): void {
  useEffect(() => {
    let active = true;
    const open = (response: Notifications.NotificationResponse | null) => {
      if (response?.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
      const route = routeFromNotificationData(response.notification.request.content.data);
      if (route) navigate(route);
    };

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!active) return;
      open(response);
      // Handled: do not open it again on the next mount.
      if (response) void Notifications.clearLastNotificationResponseAsync();
    });
    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    return () => {
      active = false;
      subscription.remove();
    };
  }, [navigate]);
}
