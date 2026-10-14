import { sessionDtoSchema } from '@icount/contracts';
import { z } from 'zod';

import type { AuthSession } from '@/core/auth/AuthSession';
import type { UserId } from '@/core/domain/Ids';
import type { HttpError } from '@/core/network/HttpError';
import type { HttpClient } from '@/core/network/httpClient';
import { isConnectivityError, problemCode } from '@/core/network/problemCode';

import { AuthError } from '../../domain/AuthError';
import type { AuthRepository } from '../../domain/AuthRepository';
import type { Session } from '../../domain/User';

/** AuthRepository over the API (ADR-0013). Tokens never leave core/auth. */
export class ApiAuthRepository implements AuthRepository {
  constructor(
    /** Unauthenticated client: the auth endpoints are public. */
    private readonly http: HttpClient,
    private readonly session: AuthSession,
  ) {}

  async requestMagicLink(email: string): Promise<void> {
    const result = await this.http.request('/v1/auth/magic-link', {
      method: 'POST',
      body: { email },
      schema: z.undefined(),
    });
    if (!result.ok) throw toAuthError(result.error);
  }

  async verifyMagicLink(token: string): Promise<Session> {
    const result = await this.http.request('/v1/auth/verify', {
      method: 'POST',
      body: { token },
      schema: sessionDtoSchema,
    });
    if (!result.ok) throw toAuthError(result.error);
    return toSession(await this.session.start(result.value));
  }

  async getSession(): Promise<Session | null> {
    const user = await this.session.currentUser();
    return user ? toSession(user) : null;
  }

  signOut(): Promise<void> {
    return this.session.signOut();
  }
}

function toSession(user: { id: string; email: string; displayName: string | null }): Session {
  return { user: { id: user.id as UserId, email: user.email, displayName: user.displayName } };
}

export function toAuthError(error: HttpError): AuthError {
  if (isConnectivityError(error)) return new AuthError('network');
  if (error.kind !== 'http') return new AuthError('unknown');

  switch (problemCode(error)) {
    case 'invalid-magic-link':
      return new AuthError('invalid-or-expired-link');
    case 'invalid-refresh-token':
    case 'refresh-token-reused':
      return new AuthError('session-expired');
    case 'too-many-magic-links':
      return new AuthError('too-many-requests');
  }
  if (error.status === 429) return new AuthError('too-many-requests');
  if (error.status === 400) return new AuthError('invalid-email');
  return new AuthError('unknown', error.problem.detail);
}
