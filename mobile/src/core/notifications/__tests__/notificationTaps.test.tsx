import { renderHook, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';

import { routeFromNotificationData } from '../notificationRoute';
import { useNotificationTaps } from '../useNotificationTaps';

jest.mock('expo-notifications', () => ({
  DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
  getLastNotificationResponseAsync: jest.fn(),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
  addNotificationResponseReceivedListener: jest.fn(),
}));

const mocked = jest.mocked;
const responseWith = (data: unknown, actionIdentifier = Notifications.DEFAULT_ACTION_IDENTIFIER) =>
  ({
    actionIdentifier,
    notification: { request: { content: { data } } },
  }) as unknown as Notifications.NotificationResponse;

describe('routeFromNotificationData', () => {
  it.each([
    [
      { event: 'shared-expense', url: '/household?filter=to-review' },
      '/household?filter=to-review',
    ],
    [{ event: 'settle-reminder', url: '/settle' }, '/settle'],
    // A newer API may send events this app does not know: the route still works.
    [{ event: 'budget-exceeded', url: '/budgets' }, '/budgets'],
  ])('opens internal routes: %j', (data, route) => {
    expect(routeFromNotificationData(data)).toBe(route);
  });

  it.each([
    [{ event: 'x', url: 'https://evil.example' }],
    [{ event: 'x', url: '//evil.example/path' }],
    [{ event: 'x', url: '/\\evil.example' }],
    [{ event: 'x', url: '/javascript:alert(1)' }],
    [{ url: '/household' }],
    [null],
    ['/household'],
  ])('ignores anything else: %j', (data) => {
    expect(routeFromNotificationData(data)).toBeNull();
  });
});

describe('useNotificationTaps', () => {
  let listener: ((response: Notifications.NotificationResponse) => void) | undefined;
  const remove = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    listener = undefined;
    mocked(Notifications.addNotificationResponseReceivedListener).mockImplementation((fn) => {
      listener = fn;
      return { remove } as unknown as ReturnType<
        typeof Notifications.addNotificationResponseReceivedListener
      >;
    });
  });

  it('opens the route of the tap that launched the app, once', async () => {
    mocked(Notifications.getLastNotificationResponseAsync).mockResolvedValue(
      responseWith({ event: 'settle-reminder', url: '/settle' }),
    );
    const navigate = jest.fn();

    await renderHook(() => useNotificationTaps(navigate));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/settle'));
    expect(Notifications.clearLastNotificationResponseAsync).toHaveBeenCalled();
  });

  it('opens taps while running, ignores other actions, and unsubscribes', async () => {
    mocked(Notifications.getLastNotificationResponseAsync).mockResolvedValue(null);
    const navigate = jest.fn();
    const { unmount } = await renderHook(() => useNotificationTaps(navigate));

    listener?.(responseWith({ event: 'shared-expense', url: '/household?filter=to-review' }));
    listener?.(responseWith({ event: 'shared-expense', url: '/household' }, 'dismiss'));
    listener?.(responseWith({ event: 'x', url: 'https://evil.example' }));

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/household?filter=to-review');
    await unmount();
    expect(remove).toHaveBeenCalled();
  });
});
