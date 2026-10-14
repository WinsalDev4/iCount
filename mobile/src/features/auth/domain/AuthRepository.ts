import type { Session } from './User';

/**
 * Port for passwordless auth (ADR-0013). Implementations: InMemoryAuthRepository
 * (B-2.2) and ApiAuthRepository (A-2.3). Failures reject with `AuthError`.
 */
export interface AuthRepository {
  /** Sends the magic link email. Resolves even if the account does not exist yet. */
  requestMagicLink(email: string): Promise<void>;
  /** Exchanges the token from `icount://auth/verify?token=…` for a session. */
  verifyMagicLink(token: string): Promise<Session>;
  /** The stored session, if any (e.g. on app start). */
  getSession(): Promise<Session | null>;
  /** Revokes the session on the server and forgets it locally. */
  signOut(): Promise<void>;
}
