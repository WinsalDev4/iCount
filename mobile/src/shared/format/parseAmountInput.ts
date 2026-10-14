import { Money, type CurrencyCode } from '@/core/domain/Money';

export type ParsedAmount =
  | { readonly ok: true; readonly amount: Money }
  | {
      readonly ok: false;
      readonly reason: 'empty' | 'invalid' | 'too-many-decimals' | 'too-large';
    };

/** 999.999.999,99 in cents: far above any real income and far below Number.MAX_SAFE_INTEGER. */
const MAX_MINOR = 99_999_999_999;

/**
 * Typed text (es-ES) → `Money` in cents, without ever going through a float.
 *
 * - `,` is the decimal separator; `.` groups thousands. When both appear, the LAST one is the
 *   decimal separator (`1.234,56` and `1,234.56` both mean 1234,56).
 * - A lone `.` followed by 1–2 digits is also read as decimal (`12.5`, `1234.56`: what people
 *   type from a numeric keypad); followed by exactly 3 digits it groups thousands (`1.234`).
 * - A lone `,` is always decimal, so `1,234` is rejected as "too many decimals".
 * - Several equal separators (`1.234.567`) must be well-formed thousands groups.
 * - At most 2 decimals, no signs: whether it is an expense or an income is the UI's job.
 * - Currency symbols and spaces are ignored (`12 €`).
 */
export function parseAmountInput(raw: string, currency: CurrencyCode = 'EUR'): ParsedAmount {
  const text = raw.replace(/[\s€$£]/g, '');
  if (text === '') return { ok: false, reason: 'empty' };
  if (!/^[0-9.,]+$/.test(text) || !/[0-9]/.test(text)) return { ok: false, reason: 'invalid' };

  const split = splitIntegerAndDecimals(text);
  if (!split) return { ok: false, reason: 'invalid' };
  const { integer, decimals } = split;

  if (decimals.length > 2) return { ok: false, reason: 'too-many-decimals' };

  const cents = Number(integer || '0') * 100 + Number(decimals.padEnd(2, '0') || '0');
  if (!Number.isSafeInteger(cents) || cents > MAX_MINOR) return { ok: false, reason: 'too-large' };
  return { ok: true, amount: Money.ofMinor(cents, currency) };
}

function splitIntegerAndDecimals(text: string): { integer: string; decimals: string } | null {
  const commas = count(text, ',');
  const dots = count(text, '.');

  // Both kinds: the last one decides, the other must be well-formed thousands groups.
  if (commas > 0 && dots > 0) {
    const decimalSeparator = text.lastIndexOf(',') > text.lastIndexOf('.') ? ',' : '.';
    const thousandsSeparator = decimalSeparator === ',' ? '.' : ',';
    const at = text.lastIndexOf(decimalSeparator);
    const head = text.slice(0, at);
    const tail = text.slice(at + 1);
    // The decimal separator must come once and after all the thousands ones.
    if (count(text, decimalSeparator) !== 1 || head.lastIndexOf(thousandsSeparator) > at) {
      return null;
    }
    if (!validGroups(head, thousandsSeparator)) return null;
    return { integer: head.split(thousandsSeparator).join(''), decimals: tail };
  }

  const separator = commas > 0 ? ',' : dots > 0 ? '.' : null;
  if (separator === null) return { integer: text, decimals: '' };

  const total = separator === ',' ? commas : dots;
  if (total > 1) {
    // Only thousands groups are possible ("1.234.567"); several commas are never valid.
    if (separator === ',' || !validGroups(text, '.')) return null;
    return { integer: text.split('.').join(''), decimals: '' };
  }

  const at = text.indexOf(separator);
  const head = text.slice(0, at);
  const tail = text.slice(at + 1);
  if (separator === '.' && tail.length === 3 && head.length >= 1 && head.length <= 3) {
    return { integer: head + tail, decimals: '' }; // "1.234" → 1234
  }
  return { integer: head, decimals: tail };
}

/** `1.234.567` → first group 1–3 digits, every other group exactly 3. */
function validGroups(text: string, separator: string): boolean {
  const [first = '', ...rest] = text.split(separator);
  return /^[0-9]{1,3}$/.test(first) && rest.every((group) => /^[0-9]{3}$/.test(group));
}

function count(text: string, char: string): number {
  return text.split(char).length - 1;
}
