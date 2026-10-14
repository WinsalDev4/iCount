import { err } from '@/core/domain/Result';

import type { HttpError } from './HttpError';
import type { HttpClient } from './httpClient';

/**
 * Supplies and renews access tokens. Same role as OkHttp's `Authenticator`
 * (or an `URLSession` delegate that refreshes and retries).
 */
export interface Authenticator {
  /** A usable access token (refreshed first if about to expire), or null if signed out. */
  accessToken(): Promise<string | null>;
  /**
   * Called after a 401 with the token that was rejected. Implementations refresh
   * at most once at a time (single-flight) and return the new token, or null if
   * the session cannot be renewed.
   */
  refresh(rejectedToken: string): Promise<string | null>;
  /**
   * Why the last renewal produced no token while the session is still alive (offline, timeout,
   * 5xx), or null. Lets callers report "no connection" instead of "signed out".
   */
  lastRenewalFailure?(): HttpError | null;
}

/**
 * Decorates an HttpClient: adds `Authorization: Bearer …` and, on a 401,
 * refreshes once and retries the request once with the new token.
 */
export function withAuthentication(client: HttpClient, auth: Authenticator): HttpClient {
  return {
    async request(path, options) {
      const token = await auth.accessToken();
      if (!token) {
        return err(
          auth.lastRenewalFailure?.() ?? {
            kind: 'http',
            status: 401,
            problem: { type: 'about:blank', title: 'Unauthorized', status: 401 },
          },
        );
      }

      const attempt = (bearer: string) =>
        client.request(path, {
          ...options,
          headers: { ...options.headers, Authorization: `Bearer ${bearer}` },
        });

      const first = await attempt(token);
      if (first.ok || first.error.kind !== 'http' || first.error.status !== 401) return first;

      const renewed = await auth.refresh(token);
      return renewed ? attempt(renewed) : first;
    },
  };
}
