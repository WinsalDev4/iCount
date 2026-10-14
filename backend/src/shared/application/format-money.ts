/**
 * Human text for an amount in cents, e.g. `12,34 €` (es-ES). Only for messages
 * people read (push, email); amounts are never computed from this (ADR-0007).
 * Built from the integer cents, so no floating point is involved.
 */
export function formatMoney(amountMinor: number, currency: string, locale = 'es-ES'): string {
  const sign = amountMinor < 0 ? '-' : '';
  const abs = Math.abs(amountMinor);
  const units = BigInt(Math.trunc(abs / 100));
  const cents = String(abs % 100).padStart(2, '0');
  const parts = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).formatToParts(units);
  return sign + parts.map((part) => (part.type === 'fraction' ? cents : part.value)).join('');
}
