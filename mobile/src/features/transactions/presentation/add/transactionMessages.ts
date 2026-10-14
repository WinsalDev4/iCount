import { TransactionError, type TransactionErrorReason } from '../../domain/TransactionError';

const messages: Record<TransactionErrorReason, string> = {
  invalid: 'Revisa los datos: el importe debe ser mayor que cero y la fecha no puede ser futura.',
  'not-found': 'No hemos encontrado ese movimiento.',
  forbidden: 'No tienes permiso para hacer esto en este hogar.',
  network: 'No hay conexión con el servidor. Revisa tu red e inténtalo de nuevo.',
  unknown: 'Algo ha salido mal. Inténtalo de nuevo.',
};

/** User-facing Spanish text for any failure; unexpected errors never leak their message. */
export function transactionErrorMessage(error: unknown): string {
  return error instanceof TransactionError ? messages[error.reason] : messages.unknown;
}
