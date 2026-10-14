import { AuthError } from '../AuthError';
import type { AuthRepository } from '../AuthRepository';
import type { Session } from '../User';

/** Exchanges the token of the deep link for a session. A missing token never reaches the API. */
export class VerifyMagicLink {
  constructor(private readonly repository: AuthRepository) {}

  execute(token: string | null | undefined): Promise<Session> {
    const trimmed = token?.trim();
    if (!trimmed) return Promise.reject(new AuthError('invalid-or-expired-link'));
    return this.repository.verifyMagicLink(trimmed);
  }
}
