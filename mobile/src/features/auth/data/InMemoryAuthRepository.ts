import type { UserId } from '@/core/domain/Ids';

import { AuthError } from '../domain/AuthError';
import type { AuthRepository } from '../domain/AuthRepository';
import { isValidEmail, normalizeEmail } from '../domain/email';
import type { Session } from '../domain/User';
import { setMemoryIdentity } from './memoryIdentity';

/**
 * Development/test adapter (`EXPO_PUBLIC_DATA_SOURCE=memory`): no backend, no email.
 * It accepts ANY non-empty token and signs in as the last address a link was requested for,
 * so the whole flow can be walked through on a bare emulator.
 */
export class InMemoryAuthRepository implements AuthRepository {
  private session: Session | null = null;
  private lastEmail = 'ana@casa.app';

  async requestMagicLink(email: string): Promise<void> {
    if (!isValidEmail(email)) throw new AuthError('invalid-email');
    this.lastEmail = normalizeEmail(email);
  }

  async verifyMagicLink(token: string): Promise<Session> {
    if (!token.trim()) throw new AuthError('invalid-or-expired-link');
    const user = {
      id: `user-${this.lastEmail}` as UserId,
      email: this.lastEmail,
      displayName: null,
    };
    this.session = { user };
    setMemoryIdentity({ userId: user.id, email: user.email, displayName: user.displayName });
    return this.session;
  }

  async getSession(): Promise<Session | null> {
    return this.session;
  }

  async signOut(): Promise<void> {
    this.session = null;
    setMemoryIdentity(null);
  }
}
