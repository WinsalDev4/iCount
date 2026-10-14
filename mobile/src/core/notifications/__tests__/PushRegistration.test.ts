import type {
  NotificationPermission,
  NotificationsGateway,
  PushPlatform,
} from '../NotificationsGateway';
import { PushRegistration } from '../PushRegistration';

const TOKEN = 'ExponentPushToken[abc]';

function gatewayWith(
  overrides: Partial<NotificationsGateway> & { permission?: NotificationPermission } = {},
) {
  const { permission = 'granted', ...rest } = overrides;
  const calls: string[] = [];
  const gateway: NotificationsGateway = {
    isPhysicalDevice: true,
    platform: 'android',
    deviceName: 'Pixel 8a',
    projectId: 'eas-project',
    ensureDefaultChannel: jest.fn(async () => {
      calls.push('channel');
    }),
    getPermission: jest.fn(async () => {
      calls.push('get');
      return permission;
    }),
    requestPermission: jest.fn(async () => {
      calls.push('request');
      return 'granted' as const;
    }),
    getExpoPushToken: jest.fn(async () => {
      calls.push('token');
      return TOKEN;
    }),
    ...rest,
  };
  return { gateway, calls };
}

function registry() {
  return {
    register: jest.fn(async (_token: string, _platform: PushPlatform, _deviceName?: string) => {}),
    unregister: jest.fn(async (_token: string) => {}),
  };
}

describe('PushRegistration', () => {
  it('asks in context, after creating the Android channel, then registers the token', async () => {
    const { gateway, calls } = gatewayWith({ permission: 'undetermined' });
    const repository = registry();

    await expect(new PushRegistration(gateway, repository).enable()).resolves.toEqual({
      kind: 'enabled',
      token: TOKEN,
    });

    expect(calls).toEqual(['channel', 'get', 'request', 'token']);
    expect(gateway.getExpoPushToken).toHaveBeenCalledWith('eas-project');
    expect(repository.register).toHaveBeenCalledWith(TOKEN, 'android', 'Pixel 8a');
  });

  it('never prompts after sign-in: it only re-registers when already granted', async () => {
    const notAsked = gatewayWith({ permission: 'undetermined' });
    const repository = registry();

    await expect(
      new PushRegistration(notAsked.gateway, repository).syncAfterSignIn(),
    ).resolves.toEqual({ kind: 'not-asked' });
    expect(notAsked.gateway.requestPermission).not.toHaveBeenCalled();
    expect(repository.register).not.toHaveBeenCalled();

    const granted = gatewayWith();
    await expect(
      new PushRegistration(granted.gateway, repository).syncAfterSignIn(),
    ).resolves.toMatchObject({ kind: 'enabled' });
  });

  it('respects a denied permission', async () => {
    const { gateway } = gatewayWith({ permission: 'denied' });
    const repository = registry();

    await expect(new PushRegistration(gateway, repository).enable()).resolves.toEqual({
      kind: 'denied',
    });
    expect(gateway.requestPermission).not.toHaveBeenCalled();
  });

  it('does nothing on emulators or without an EAS project', async () => {
    const repository = registry();

    await expect(
      new PushRegistration(gatewayWith({ isPhysicalDevice: false }).gateway, repository).enable(),
    ).resolves.toEqual({ kind: 'unsupported', reason: 'not-a-device' });
    await expect(
      new PushRegistration(gatewayWith({ projectId: null }).gateway, repository).enable(),
    ).resolves.toEqual({ kind: 'unsupported', reason: 'no-project' });
    expect(repository.register).not.toHaveBeenCalled();
  });

  it('reports failures (offline token request, API down) instead of throwing', async () => {
    const offline = gatewayWith({
      getExpoPushToken: jest.fn(async () => Promise.reject(new Error('offline'))),
    });

    const status = await new PushRegistration(offline.gateway, registry()).syncAfterSignIn();

    expect(status).toEqual({ kind: 'failed', error: new Error('offline') });
  });

  it('unregisters on sign-out, once, and tolerates being offline', async () => {
    const repository = registry();
    repository.unregister.mockRejectedValueOnce(new Error('offline'));
    const registration = new PushRegistration(gatewayWith().gateway, repository);
    await registration.syncAfterSignIn();

    await expect(registration.signOut()).resolves.toBeUndefined();
    await registration.signOut();

    expect(repository.unregister).toHaveBeenCalledTimes(1);
    expect(repository.unregister).toHaveBeenCalledWith(TOKEN);
  });
});
