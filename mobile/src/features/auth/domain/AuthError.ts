/**
 * Expected auth failures, so ViewModels can show the right message without
 * knowing about HTTP. Repositories translate transport errors into these.
 */
export type AuthErrorReason =
  | 'invalid-email'
  | 'invalid-or-expired-link'
  | 'too-many-requests'
  | 'session-expired'
  | 'network'
  | 'unknown';

export class AuthError extends Error {
  constructor(
    readonly reason: AuthErrorReason,
    message: string = reason,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}
