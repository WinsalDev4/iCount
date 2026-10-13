import { createHttpClient, type HttpClient } from '@/core/network/httpClient';
import { withAuthentication } from '@/core/network/withAuthentication';

import { AuthSession } from './AuthSession';
import { expoSecureStorage } from './expoSecureStorage';
import { type SecureKeyValueStorage, SessionStore } from './SessionStore';

export interface ApiClients {
  /** For the public auth endpoints (magic link, verify, logout). */
  readonly publicHttp: HttpClient;
  /** Adds the access token and renews it transparently. */
  readonly http: HttpClient;
  readonly session: AuthSession;
}

export interface ApiClientsConfig {
  readonly baseUrl: string;
  readonly storage?: SecureKeyValueStorage;
  readonly fetch?: typeof fetch;
}

/** One session and two clients per app; the composition root (container) owns them. */
export function createApiClients(config: ApiClientsConfig): ApiClients {
  const publicHttp = createHttpClient({ baseUrl: config.baseUrl, fetch: config.fetch });
  const session = new AuthSession(
    new SessionStore(config.storage ?? expoSecureStorage),
    publicHttp,
  );
  return { publicHttp, http: withAuthentication(publicHttp, session), session };
}
