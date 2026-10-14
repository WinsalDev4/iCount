import { describe, expect, it } from 'vitest';

import {
  emailSchema,
  refreshSessionRequestSchema,
  requestMagicLinkRequestSchema,
  sessionDtoSchema,
  verifyMagicLinkRequestSchema,
} from '../index.ts';

const user = {
  id: '0199e0a4-5b2c-7c3d-9e4f-123456789abc',
  email: 'ana@icount.app',
  displayName: null,
  createdAt: '2026-10-14T08:00:00.000Z',
};

describe('emailSchema', () => {
  it('normalises case and surrounding spaces', () => {
    expect(emailSchema.parse('  Ana@ICount.App ')).toBe('ana@icount.app');
  });

  it.each(['', 'ana', 'ana@', '@icount.app', 'ana @icount.app'])('rejects %j', (email) => {
    expect(emailSchema.safeParse(email).success).toBe(false);
  });
});

describe('auth requests', () => {
  it('accepts a magic link request', () => {
    expect(requestMagicLinkRequestSchema.parse({ email: 'Ana@icount.app' })).toEqual({
      email: 'ana@icount.app',
    });
  });

  it('requires tokens that look like real random tokens', () => {
    const token = 'k3J9xQ2mZr8vT1pLw0aYbC';
    expect(verifyMagicLinkRequestSchema.parse({ token })).toEqual({ token });
    expect(verifyMagicLinkRequestSchema.safeParse({ token: 'short' }).success).toBe(false);
    expect(refreshSessionRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe('sessionDtoSchema', () => {
  const session = {
    accessToken: 'eyJhbGciOiJIUzI1NiJ9.e30.sig',
    accessTokenExpiresAt: '2026-10-14T08:15:00.000Z',
    refreshToken: 'r'.repeat(43),
    user,
  };

  it('parses a session', () => {
    expect(sessionDtoSchema.parse(session)).toEqual(session);
  });

  it.each([
    ['a non-ISO expiry', { ...session, accessTokenExpiresAt: '14/10/2026' }],
    ['a user id that is not a UUID', { ...session, user: { ...user, id: 'u1' } }],
    ['a missing refresh token', { ...session, refreshToken: undefined }],
  ])('rejects %s', (_, value) => {
    expect(sessionDtoSchema.safeParse(value).success).toBe(false);
  });
});
