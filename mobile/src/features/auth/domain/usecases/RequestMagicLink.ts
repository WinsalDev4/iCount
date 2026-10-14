import { AuthError } from '../AuthError';
import type { AuthRepository } from '../AuthRepository';
import { isValidEmail, normalizeEmail } from '../email';

/** Asks for the sign-in email. Resolves with the normalized address the link was sent to. */
export class RequestMagicLink {
  constructor(private readonly repository: AuthRepository) {}

  async execute(email: string): Promise<string> {
    if (!isValidEmail(email)) throw new AuthError('invalid-email');
    const normalized = normalizeEmail(email);
    await this.repository.requestMagicLink(normalized);
    return normalized;
  }
}
