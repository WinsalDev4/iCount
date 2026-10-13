import { type SessionDto, sessionDtoSchema } from '@icount/contracts';
import { z } from 'zod';

import { createHttpClient } from '@/core/network/httpClient';
import { withAuthentication } from '@/core/network/withAuthentication';

import { AuthSession } from '../AuthSession';
import { type SecureKeyValueStorage, SESSION_KEY, SessionStore } from '../SessionStore';

const user = {
  id: '0199e0a4-5b2c-7c3d-9e4f-0000000000a1',
  email: 'ana@icount.app',
  displayName: null,
  createdAt: '2026-10-14T08:00:00.000Z',
};
const HOUR = 60 * 60 * 1000;

class MemoryStorage implements SecureKeyValueStorage {
  readonly items = new Map<string, string>();
  async getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  async setItem(key: string, value: string) {
    this.items.set(key, value);
  }
  async deleteItem(key: string) {
    this.items.delete(key);
  }
}

/** Tiny fake of the API: valid access tokens, rotating refresh tokens, a protected route. */
function fakeServer() {
  const state = {
    validAccess: new Set<string>(),
    validRefresh: new Set<string>(),
    refreshCalls: 0,
    protectedCalls: 0,
    logoutBodies: [] as unknown[],
    networkDown: false,
    sequence: 0,
  };
  const json = (status: number, body?: unknown) =>
    ({
      ok: status >= 200 && status < 300,
      status,
      statusText: '',
      text: async () => (body === undefined ? '' : JSON.stringify(body)),
    }) as unknown as Response;

  const issue = (): SessionDto => {
    state.sequence += 1;
    const accessToken = `access-${state.sequence}`;
    const refreshToken = `refresh-token-number-${state.sequence}`;
    state.validAccess.add(accessToken);
    state.validRefresh.add(refreshToken);
    return sessionDtoSchema.parse({
      accessToken,
      accessTokenExpiresAt: new Date(Date.now() + HOUR).toISOString(),
      refreshToken,
      user,
    });
  };

  const fetchMock = jest.fn(async (url: string, init: RequestInit) => {
    if (state.networkDown) throw new TypeError('Network request failed');
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    // Let concurrent callers pile up, as on a real network.
    await new Promise((resolve) => setTimeout(resolve, 5));

    if (url.endsWith('/v1/auth/refresh')) {
      state.refreshCalls += 1;
      if (!state.validRefresh.delete(body.refreshToken)) {
        return json(401, { type: '/problems/refresh-token-reused', status: 401 });
      }
      return json(200, issue());
    }
    if (url.endsWith('/v1/auth/logout')) {
      state.logoutBodies.push(body);
      return json(204);
    }
    state.protectedCalls += 1;
    const token = String((init.headers as Record<string, string>).Authorization ?? '').slice(7);
    return state.validAccess.has(token) ? json(200, { ok: true }) : json(401, { status: 401 });
  });

  return { state, fetchMock, issue };
}

function setup() {
  const server = fakeServer();
  const storage = new MemoryStorage();
  const publicHttp = createHttpClient({
    baseUrl: 'http://api.test',
    fetch: server.fetchMock as unknown as typeof fetch,
  });
  const session = new AuthSession(new SessionStore(storage), publicHttp);
  const http = withAuthentication(publicHttp, session);
  const callProtected = () => http.request('/v1/things', { schema: z.object({ ok: z.boolean() }) });
  return { server, storage, session, callProtected };
}

describe('AuthSession', () => {
  it('refreshes once for several concurrent 401s and retries them all', async () => {
    const { server, session, callProtected } = setup();
    // The server no longer accepts this access token (expired, secret rotated…).
    const signedIn = server.issue();
    server.state.validAccess.delete(signedIn.accessToken);
    await session.start(signedIn);

    const results = await Promise.all([callProtected(), callProtected(), callProtected()]);

    expect(results.every((r) => r.ok)).toBe(true);
    expect(server.state.refreshCalls).toBe(1);
  });

  it('refreshes proactively when the access token is about to expire', async () => {
    const { server, session, callProtected } = setup();
    await session.start({
      ...server.issue(),
      accessTokenExpiresAt: new Date(Date.now() + 10_000).toISOString(),
    });

    expect((await callProtected()).ok).toBe(true);
    expect(server.state.refreshCalls).toBe(1);
    expect(server.state.protectedCalls).toBe(1);
  });

  it('signs out and notifies when the server rejects the refresh', async () => {
    const { server, storage, session, callProtected } = setup();
    const signedIn = server.issue();
    server.state.validAccess.delete(signedIn.accessToken);
    server.state.validRefresh.clear(); // e.g. revoked after a reuse was detected
    await session.start(signedIn);
    const onExpired = jest.fn();
    session.onSessionExpired(onExpired);

    const results = await Promise.all([callProtected(), callProtected()]);

    expect(results.map((r) => !r.ok && r.error.kind === 'http' && r.error.status)).toEqual([
      401, 401,
    ]);
    expect(onExpired).toHaveBeenCalledTimes(1);
    expect(storage.items.has(SESSION_KEY)).toBe(false);
    expect(await session.currentUser()).toBeNull();
  });

  it('keeps the session when the refresh fails for lack of network', async () => {
    const { server, session, callProtected } = setup();
    const signedIn = server.issue();
    await session.start({ ...signedIn, accessTokenExpiresAt: new Date(0).toISOString() });
    const onExpired = jest.fn();
    session.onSessionExpired(onExpired);
    server.state.networkDown = true;

    const result = await callProtected();

    expect(result.ok).toBe(false);
    expect(onExpired).not.toHaveBeenCalled();
    expect(await session.currentUser()).toMatchObject({ email: 'ana@icount.app' });
  });

  it('does not call the API at all without a session', async () => {
    const { server, callProtected } = setup();

    const result = await callProtected();

    expect(!result.ok && result.error.kind === 'http' && result.error.status).toBe(401);
    expect(server.fetchMock).not.toHaveBeenCalled();
  });

  it('signs out voluntarily: revokes on the server and forgets locally', async () => {
    const { server, storage, session } = setup();
    const signedIn = server.issue();
    await session.start(signedIn);
    const onExpired = jest.fn();
    session.onSessionExpired(onExpired);

    await session.signOut();

    expect(server.state.logoutBodies).toEqual([{ refreshToken: signedIn.refreshToken }]);
    expect(storage.items.size).toBe(0);
    expect(onExpired).not.toHaveBeenCalled();
  });
});

describe('SessionStore', () => {
  it('treats corrupt data as signed out and cleans it up', async () => {
    const storage = new MemoryStorage();
    storage.items.set(SESSION_KEY, '{not json');
    const store = new SessionStore(storage);

    expect(await store.load()).toBeNull();
    expect(storage.items.has(SESSION_KEY)).toBe(false);
  });
});
