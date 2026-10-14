import { AuthError, type AuthErrorReason } from '../../domain/AuthError';
import { authErrorMessage } from '../authMessages';

describe('authErrorMessage', () => {
  const reasons: AuthErrorReason[] = [
    'invalid-email',
    'invalid-or-expired-link',
    'too-many-requests',
    'session-expired',
    'network',
    'unknown',
  ];

  it.each(reasons)('has a Spanish message for %s', (reason) => {
    const message = authErrorMessage(new AuthError(reason));
    expect(message.length).toBeGreaterThan(10);
    expect(message).not.toBe(reason);
  });

  it('gives each reason a distinct message', () => {
    const messages = reasons.map((reason) => authErrorMessage(new AuthError(reason)));
    expect(new Set(messages).size).toBe(reasons.length);
  });

  it('never leaks the text of an unexpected error', () => {
    expect(authErrorMessage(new Error('ECONNRESET at 10.0.2.2:3000'))).toBe(
      authErrorMessage(new AuthError('unknown')),
    );
    expect(authErrorMessage('boom')).toBe(authErrorMessage(new AuthError('unknown')));
  });
});
