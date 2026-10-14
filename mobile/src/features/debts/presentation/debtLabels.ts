import { DebtError, type DebtErrorReason } from '../domain/DebtError';
import type { DebtKind } from '../domain/Debt';

export const KIND_LABELS: Record<DebtKind, string> = {
  car: 'Coche',
  mortgage: 'Hipoteca',
  personal: 'Personal',
  'credit-card': 'Tarjeta',
  other: 'Otra',
};

export const KIND_OPTIONS = (Object.keys(KIND_LABELS) as DebtKind[]).map((value) => ({
  value,
  label: KIND_LABELS[value],
}));

const messages: Record<DebtErrorReason, string> = {
  'not-found': 'Esa deuda ya no existe.',
  invalid:
    'Revisa los datos: la cuota tiene que cubrir al menos los intereses del mes, y el importe, el plazo y el tipo deben ser válidos.',
  network: 'No hay conexión con el servidor. Revisa tu red e inténtalo de nuevo.',
  unknown: 'Algo ha salido mal. Inténtalo de nuevo.',
};

/** User-facing Spanish text for any failure; unexpected errors never leak their message. */
export function debtErrorMessage(error: unknown): string {
  return error instanceof DebtError ? messages[error.reason] : messages.unknown;
}

const monthYear = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' });
const dayMonthYear = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export const formatMonthYear = (date: Date) => monthYear.format(date);
export const formatDate = (date: Date) => dayMonthYear.format(date);

/** 1 → "1 mes", 14 → "1 año y 2 meses", 24 → "2 años". */
export function formatMonths(months: number): string {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const y = years === 0 ? '' : years === 1 ? '1 año' : `${years} años`;
  const m = rest === 0 ? '' : rest === 1 ? '1 mes' : `${rest} meses`;
  if (y && m) return `${y} y ${m}`;
  return y || m || '0 meses';
}
