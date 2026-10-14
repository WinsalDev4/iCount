import request from 'supertest';

import { createTestApp, type TestApp } from './support/create-test-app.js';

/**
 * Passwordless auth end to end (ADR-0013). A fresh app per test: the per-IP
 * throttler keeps its counters in memory and would leak between tests.
 */
describe('auth (e2e)', () => {
  let testApp: TestApp;
  const http = () => request(testApp.app.getHttpServer());

  beforeEach(async () => {
    testApp = await createTestApp();
    await testApp.truncate('magic_links', 'refresh_tokens', 'users');
  });

  afterEach(async () => {
    await testApp.app.close();
  });

  async function signInWithMagicLink(email: string) {
    await http().post('/v1/auth/magic-link').send({ email }).expect(202);
    const token = testApp.emails.lastMagicLinkToken(email.trim().toLowerCase());
    const response = await http().post('/v1/auth/verify').send({ token }).expect(200);
    return response.body as {
      accessToken: string;
      refreshToken: string;
      user: { id: string; email: string };
    };
  }

  it('signs in with a magic link and uses the access token', async () => {
    const session = await signInWithMagicLink('  Ana@ICount.app ');

    expect(session.user).toMatchObject({ email: 'ana@icount.app', displayName: null });
    const me = await http()
      .get('/v1/me')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(200);
    expect(me.body.id).toBe(session.user.id);
  });

  it('answers the same for registered and unknown emails (no enumeration)', async () => {
    await signInWithMagicLink('ana@icount.app');

    const known = await http().post('/v1/auth/magic-link').send({ email: 'ana@icount.app' });
    const unknown = await http().post('/v1/auth/magic-link').send({ email: 'nadie@icount.app' });

    expect([known.status, unknown.status]).toEqual([202, 202]);
    expect(known.text).toBe(unknown.text);
  });

  it('accepts each link once', async () => {
    await http().post('/v1/auth/magic-link').send({ email: 'ana@icount.app' }).expect(202);
    const token = testApp.emails.lastMagicLinkToken('ana@icount.app');

    await http().post('/v1/auth/verify').send({ token }).expect(200);
    const replay = await http().post('/v1/auth/verify').send({ token }).expect(401);

    expect(replay.body).toMatchObject({ type: '/problems/invalid-magic-link', status: 401 });
  });

  it('limits links per email', async () => {
    for (let i = 0; i < 3; i++) {
      await http().post('/v1/auth/magic-link').send({ email: 'ana@icount.app' }).expect(202);
    }
    const limited = await http()
      .post('/v1/auth/magic-link')
      .send({ email: 'ana@icount.app' })
      .expect(429);

    expect(limited.body.type).toBe('/problems/too-many-magic-links');
  });

  it('throttles magic link requests per client', async () => {
    for (let i = 0; i < 5; i++) {
      await http()
        .post('/v1/auth/magic-link')
        .send({ email: `user${i}@icount.app` })
        .expect(202);
    }

    await http().post('/v1/auth/magic-link').send({ email: 'other@icount.app' }).expect(429);
  });

  it('rotates refresh tokens and revokes the family when one is reused', async () => {
    const session = await signInWithMagicLink('ana@icount.app');

    const rotated = await http()
      .post('/v1/auth/refresh')
      .send({ refreshToken: session.refreshToken })
      .expect(200);
    expect(rotated.body.refreshToken).not.toBe(session.refreshToken);

    const reused = await http()
      .post('/v1/auth/refresh')
      .send({ refreshToken: session.refreshToken })
      .expect(401);
    expect(reused.body.type).toBe('/problems/refresh-token-reused');

    await http()
      .post('/v1/auth/refresh')
      .send({ refreshToken: rotated.body.refreshToken })
      .expect(401);
  });

  it('lets only one of two concurrent refreshes with the same token win', async () => {
    const session = await signInWithMagicLink('ana@icount.app');

    const results = await Promise.all(
      [1, 2].map(() =>
        http().post('/v1/auth/refresh').send({ refreshToken: session.refreshToken }),
      ),
    );

    expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([200, 401]);
  });

  it('logs out by revoking the refresh token family', async () => {
    const session = await signInWithMagicLink('ana@icount.app');

    await http().post('/v1/auth/logout').send({ refreshToken: session.refreshToken }).expect(204);
    await http().post('/v1/auth/logout').send({ refreshToken: session.refreshToken }).expect(204);

    await http().post('/v1/auth/refresh').send({ refreshToken: session.refreshToken }).expect(401);
  });

  it('rejects missing, malformed and forged access tokens', async () => {
    await http().get('/v1/me').expect(401);
    await http().get('/v1/me').set('Authorization', 'Bearer not-a-jwt').expect(401);
    const forged =
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIiwidHlwIjoiYWNjZXNzIn0.' +
      'c2lnbmVkLXdpdGgtYW5vdGhlci1zZWNyZXQ';
    await http().get('/v1/me').set('Authorization', `Bearer ${forged}`).expect(401);
  });
});
