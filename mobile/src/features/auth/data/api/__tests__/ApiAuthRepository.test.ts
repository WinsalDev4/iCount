import { AuthSession } from '@/core/auth/AuthSession';
import { type SecureKeyValueStorage, SessionStore } from '@/core/auth/SessionStore';
import { err, ok } from '@/core/domain/Result';
import type { HttpError } from '@/core/network/HttpError';
import type { HttpClient } from '@/core/network/httpClient';

import { AuthError } from '../../../domain/AuthError';
import { ApiAuthRepository, toAuthError } from '../ApiAuthRepository';

const sessionDto = {
  accessToken: 'jwt',
  accessTokenExpiresAt: '2099-01-01T00:00:00.000Z',
  refreshToken: 'refresh-token-long-enough',
  user: {
    id: '0199e0a4-5b2c-7c3d-9e4f-0000000000a1',
    email: 'ana@icount.app',
    displayName: null,
    createdAt: '2026-10-14T08:00:00.000Z',
  },
};

function memoryStorage(): SecureKeyValueStorage {
  const items = new Map<string, string>();
  return {
    getItem: async (key) => items.get(key) ?? null,
    setItem: async (key, value) => void items.set(key, value),
    deleteItem: async (key) => void items.delete(key),
  };
}

function setup(respond: (path: string) => ReturnType<HttpClient['request']>) {
  const request = jest.fn((path: string) => respond(path));
  const http = { request } as unknown as HttpClient;
  const session = new AuthSession(new SessionStore(memoryStorage()), http);
  return { request, session, repository: new ApiAuthRepository(http, session) };
}

const problem = (status: number, type = 'about:blank'): HttpError => ({
  kind: 'http',
  status,
  problem: { type, status },
});

describe('ApiAuthRepository', () => {
  it('verifies a link, stores the session and exposes only the user', async () => {
    const { repository, request } = setup(async () => ok(sessionDto));

    const session = await repository.verifyMagicLink('token-from-deep-link');

    expect(request).toHaveBeenCalledWith(
      '/v1/auth/verify',
      expect.objectContaining({ method: 'POST', body: { token: 'token-from-deep-link' } }),
    );
    expect(session).toEqual({
      user: { id: sessionDto.user.id, email: 'ana@icount.app', displayName: null },
    });
    await expect(repository.getSession()).resolves.toEqual(session);
  });

  it('turns API failures into domain errors', async () => {
    const { repository } = setup(async () => err(problem(401, '/problems/invalid-magic-link')));

    await expect(repository.verifyMagicLink('used')).rejects.toEqual(
      new AuthError('invalid-or-expired-link'),
    );
  });

  it('has no session until one is verified', async () => {
    const { repository } = setup(async () => ok(undefined));

    await repository.requestMagicLink('ana@icount.app');

    await expect(repository.getSession()).resolves.toBeNull();
  });
});

describe('toAuthError', () => {
  it.each([
    [{ kind: 'network', message: 'offline' } as HttpError, 'network'],
    [{ kind: 'timeout', timeoutMs: 15_000 } as HttpError, 'network'],
    [problem(429, '/problems/too-many-magic-links'), 'too-many-requests'],
    [problem(429), 'too-many-requests'],
    [problem(400, '/problems/validation-error'), 'invalid-email'],
    [problem(401, '/problems/refresh-token-reused'), 'session-expired'],
    [problem(500), 'unknown'],
  ])('maps %j to %s', (error, reason) => {
    expect(toAuthError(error).reason).toBe(reason);
  });
});
