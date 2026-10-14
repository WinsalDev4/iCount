import { HouseholdError, type HouseholdErrorReason } from '../domain/HouseholdError';

const messages: Record<HouseholdErrorReason, string> = {
  'invalid-invite': 'Ese código no es válido. Revísalo con quien te invitó.',
  'expired-invite': 'Ese código ha caducado. Pide uno nuevo a quien te invitó.',
  'already-member': 'Ya formas parte de ese hogar.',
  'not-found': 'No hemos encontrado ese hogar.',
  forbidden: 'Solo quien administra el hogar puede cambiar esto.',
  'invalid-split-rule': 'Ese reparto no es válido: las partes deben sumar el 100 %.',
  network: 'No hay conexión con el servidor. Revisa tu red e inténtalo de nuevo.',
  unknown: 'Algo ha salido mal. Inténtalo de nuevo.',
};

/** User-facing Spanish text for any failure; unexpected errors never leak their message. */
export function householdErrorMessage(error: unknown): string {
  return error instanceof HouseholdError ? messages[error.reason] : messages.unknown;
}
