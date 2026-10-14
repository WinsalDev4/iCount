import { type SessionDto, sessionDtoSchema } from '@icount/contracts';
import { z } from 'zod';

import type { HttpError } from '@/core/network/HttpError';
import type { HttpClient } from '@/core/network/httpClient';
import type { Authenticator } from '@/core/network/withAuthentication';

import type { SessionStore, StoredSession } from './SessionStore';

/** Refresh a bit before expiry so requests in flight do not race the deadline. */
export const ACCESS_TOKEN_MARGIN_MS = 30_000;

type StoredUser = StoredSession['user'];

/**
 * The signed-in session of this device (ADR-0013):
 * - refresh token + user in SecureStore (survive restarts), access token only in memory;
 * - single-flight refresh: N concurrent 401s trigger exactly one POST /auth/refresh;
 * - signs out locally only when the server rejects the refresh (401), never because
 *   the phone is offline, and notifies listeners so the UI can go to the login screen.
 */
export class AuthSession implements Authenticator {
  private access: { token: string; expiresAt: Date } | null = null;
  private inflight: Promise<string | null> | null = null;
  private renewalFailure: HttpError | null = null;
  private readonly expiredListeners = new Set<() => void>();

  constructor(
    private readonly store: SessionStore,
    /** Unauthenticated client: the auth endpoints are public. */
    private readonly http: HttpClient,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Stores a session returned by /auth/verify. */
  start(session: SessionDto): Promise<StoredUser> {
    return this.persist(session);
  }

  /** Who is signed in on this device, without network. */
  async currentUser(): Promise<StoredUser | null> {
    return (await this.store.load())?.user ?? null;
  }

  async accessToken(): Promise<string | null> {
    if (
      this.access &&
      this.access.expiresAt.getTime() - this.now().getTime() > ACCESS_TOKEN_MARGIN_MS
    ) {
      return this.access.token;
    }
    return this.renew();
  }

  async refresh(rejectedToken: string): Promise<string | null> {
    // Another request already renewed it while this one was in flight: reuse.
    if (this.access && this.access.token !== rejectedToken) return this.access.token;
    return this.renew();
  }

  /** Voluntary sign-out: revokes on the server (best effort) and forgets locally. */
  async signOut(): Promise<void> {
    const stored = await this.store.load();
    this.access = null;
    await this.store.clear();
    if (stored) {
      await this.http.request('/v1/auth/logout', {
        method: 'POST',
        body: { refreshToken: stored.refreshToken },
        schema: z.undefined(),
      });
    }
  }

  lastRenewalFailure(): HttpError | null {
    return this.renewalFailure;
  }

  /** Called when the session dies on its own (revoked, expired). Returns an unsubscribe function. */
  onSessionExpired(listener: () => void): () => void {
    this.expiredListeners.add(listener);
    return () => this.expiredListeners.delete(listener);
  }

  private renew(): Promise<string | null> {
    this.inflight ??= this.doRefresh().finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  private async doRefresh(): Promise<string | null> {
    const stored = await this.store.load();
    if (!stored) return null;

    const result = await this.http.request('/v1/auth/refresh', {
      method: 'POST',
      body: { refreshToken: stored.refreshToken },
      schema: sessionDtoSchema,
    });
    if (result.ok) {
      this.renewalFailure = null;
      await this.persist(result.value);
      return result.value.accessToken;
    }

    const rejected = result.error.kind === 'http' && result.error.status === 401;
    if (rejected) {
      this.renewalFailure = null;
      await this.expire();
      return null;
    }
    // Offline, timeout or 5xx: keep the session; the next request will try again.
    this.renewalFailure = result.error;
    return null;
  }

  private async persist(session: SessionDto): Promise<StoredUser> {
    const user = {
      id: session.user.id,
      email: session.user.email,
      displayName: session.user.displayName,
    };
    await this.store.save({ refreshToken: session.refreshToken, user });
    this.access = {
      token: session.accessToken,
      expiresAt: new Date(session.accessTokenExpiresAt),
    };
    return user;
  }

  private async expire(): Promise<void> {
    this.access = null;
    await this.store.clear();
    for (const listener of this.expiredListeners) listener();
  }
}
