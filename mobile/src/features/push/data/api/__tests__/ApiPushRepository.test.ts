import { err, ok } from '@/core/domain/Result';
import type { HttpClient } from '@/core/network/httpClient';

import { ApiPushRepository } from '../ApiPushRepository';

const TOKEN = 'ExponentPushToken[abc]';

function repositoryWith(responses: Awaited<ReturnType<HttpClient['request']>>[]) {
  const request = jest.fn(async () => responses.shift()!);
  return { request, repository: new ApiPushRepository({ request } as unknown as HttpClient) };
}

describe('ApiPushRepository', () => {
  it('registers the device with PUT (idempotent on the server)', async () => {
    const { repository, request } = repositoryWith([ok(undefined)]);

    await repository.register(TOKEN, 'ios', 'iPhone de Ana');

    expect(request).toHaveBeenCalledWith(
      '/v1/me/push-tokens',
      expect.objectContaining({
        method: 'PUT',
        body: { token: TOKEN, platform: 'ios', deviceName: 'iPhone de Ana' },
      }),
    );
  });

  it('unregisters it with DELETE on sign-out', async () => {
    const { repository, request } = repositoryWith([ok(undefined)]);

    await repository.unregister(TOKEN);

    expect(request).toHaveBeenCalledWith(
      '/v1/me/push-tokens',
      expect.objectContaining({ method: 'DELETE', body: { token: TOKEN } }),
    );
  });

  it('rejects when the API fails, so the caller can retry later', async () => {
    const { repository } = repositoryWith([err({ kind: 'network', message: 'offline' })]);

    await expect(repository.register(TOKEN, 'android')).rejects.toThrow('offline');
  });
});
