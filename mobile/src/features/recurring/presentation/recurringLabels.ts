import { startOfDay } from '@/features/transactions/domain/calendar';

import { RecurringError, type RecurringErrorReason } from '../domain/RecurringError';
import type { RecurringKind } from '../domain/RecurringPayment';

export const KIND_LABELS: Record<RecurringKind, string> = {
  bill: 'Factura',
  loan: 'Letra',
  subscription: 'Suscripción',
  income: 'Ingreso',
  other: 'Otro',
};

export const KIND_OPTIONS = (Object.keys(KIND_LABELS) as RecurringKind[]).map((value) => ({
  value,
  label: KIND_LABELS[value],
}));

/** The category each kind starts with (the person can change it). */
export const DEFAULT_CATEGORY: Record<RecurringKind, string> = {
  bill: 'bills',
  loan: 'loans',
  subscription: 'leisure',
  income: 'salary',
  other: 'other',
};

const messages: Record<RecurringErrorReason, string> = {
  'not-found': 'Ese pago ya no existe.',
  invalid: 'Revisa los datos: el nombre, el importe y la fecha tienen que ser válidos.',
  network: 'No hay conexión con el servidor. Revisa tu red e inténtalo de nuevo.',
  unknown: 'Algo ha salido mal. Inténtalo de nuevo.',
};

/** User-facing Spanish text for any failure; unexpected errors never leak their message. */
export function recurringErrorMessage(error: unknown): string {
  return error instanceof RecurringError ? messages[error.reason] : messages.unknown;
}

const dayMonthYear = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const dayMonth = new Intl.DateTimeFormat('es-ES', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

export const formatDate = (date: Date) => dayMonthYear.format(date);
export const formatShortDate = (date: Date) => dayMonth.format(date);

/** "hoy" · "mañana" · "en 5 días" (calendar days, so daylight saving never skews it). */
export function relativeDays(date: Date, today: Date): string {
  const a = startOfDay(date);
  const b = startOfDay(today);
  const days = Math.round(
    (Date.UTC(a.getFullYear(), a.getMonth(), a.getDate()) -
      Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())) /
      86_400_000,
  );
  if (days === 0) return 'hoy';
  if (days === 1) return 'mañana';
  return days < 0 ? `hace ${-days} días` : `en ${days} días`;
}
