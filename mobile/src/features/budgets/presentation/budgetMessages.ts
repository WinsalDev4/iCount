import { BudgetError, type BudgetErrorReason } from '../domain/BudgetError';

const messages: Record<BudgetErrorReason, string> = {
  duplicate: 'Ya hay un presupuesto para esa categoría este mes.',
  'not-found': 'Ese presupuesto ya no existe.',
  'insufficient-amount':
    'No se puede mover tanto: el presupuesto de origen se quedaría por debajo de lo que ya has gastado.',
  invalid: 'Revisa los datos: el importe debe ser mayor que cero.',
  network: 'No hay conexión con el servidor. Revisa tu red e inténtalo de nuevo.',
  unknown: 'Algo ha salido mal. Inténtalo de nuevo.',
};

/** User-facing Spanish text for any failure; unexpected errors never leak their message. */
export function budgetErrorMessage(error: unknown): string {
  return error instanceof BudgetError ? messages[error.reason] : messages.unknown;
}
