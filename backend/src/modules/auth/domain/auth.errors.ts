import { DomainError } from '../../../shared/domain/domain-error.js';

export class InvalidMagicLinkError extends DomainError {
  readonly kind = 'unauthenticated';
  readonly code = 'invalid-magic-link';
  readonly title = 'Invalid or expired link';

  constructor() {
    super('This sign-in link is not valid any more. Request a new one.');
  }
}

export class InvalidRefreshTokenError extends DomainError {
  readonly kind = 'unauthenticated';
  readonly code = 'invalid-refresh-token';
  readonly title = 'Session expired';

  constructor() {
    super('The session is no longer valid. Sign in again.');
  }
}

/** A used refresh token came back: it was copied, so the whole session family is revoked. */
export class RefreshTokenReusedError extends DomainError {
  readonly kind = 'unauthenticated';
  readonly code = 'refresh-token-reused';
  readonly title = 'Session revoked';

  constructor() {
    super('This session was used from somewhere else and has been closed. Sign in again.');
  }
}

export class TooManyMagicLinksError extends DomainError {
  readonly kind = 'rate_limited';
  readonly code = 'too-many-magic-links';
  readonly title = 'Too many sign-in links';

  constructor(windowMinutes: number) {
    super(`Too many links requested for this email. Try again in ${windowMinutes} minutes.`);
  }
}
