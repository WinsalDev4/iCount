import { AuthError, type AuthErrorReason } from '../domain/AuthError';

const messages: Record<AuthErrorReason, string> = {
  'invalid-email': 'Introduce un correo válido, por ejemplo ana@casa.app.',
  'invalid-or-expired-link':
    'Este enlace ya no es válido. Pide uno nuevo y ábrelo antes de 15 minutos.',
  'too-many-requests': 'Has pedido demasiados enlaces. Espera unos minutos e inténtalo de nuevo.',
  'session-expired': 'Tu sesión ha caducado. Vuelve a entrar.',
  network: 'No hay conexión con el servidor. Revisa tu red e inténtalo de nuevo.',
  unknown: 'Algo ha salido mal. Inténtalo de nuevo.',
};

/** User-facing Spanish text for any failure; unknown errors never leak their message. */
export function authErrorMessage(error: unknown): string {
  return error instanceof AuthError ? messages[error.reason] : messages.unknown;
}
