/**
 * The amount typed on the custom keypad of "Añadir movimiento".
 *
 * The amount is kept as TEXT while it is typed ("12,5") and only becomes `Money` at the end
 * (shared/format/parseAmountInput): that way "12," or "0,0" are valid half-typed states and no
 * float ever represents money. These pure functions are the whole keypad logic, so the screen only
 * forwards taps. Kotlin analogy: the reducer of a calculator ViewModel.
 */
export type KeypadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | ',' | 'delete';

export const MAX_INTEGER_DIGITS = 7; // up to 9.999.999 €
export const MAX_DECIMALS = 2;

export function applyKey(text: string, key: KeypadKey): string {
  if (key === 'delete') return text.slice(0, -1);

  const comma = text.indexOf(',');
  const hasDecimals = comma >= 0;
  const integerPart = hasDecimals ? text.slice(0, comma) : text;
  const decimals = hasDecimals ? text.slice(comma + 1) : '';

  if (key === ',') {
    if (hasDecimals) return text; // only one decimal separator
    return text === '' ? '0,' : `${text},`;
  }

  // A digit.
  if (hasDecimals) {
    return decimals.length >= MAX_DECIMALS ? text : `${text}${key}`;
  }
  if (integerPart === '0') return key === '0' ? text : key; // no leading zeros: "05" → "5"
  if (integerPart.length >= MAX_INTEGER_DIGITS) return text;
  return `${text}${key}`;
}

/** What the big number on the screen shows: thousands grouped, empty text is "0". */
export function displayAmount(text: string): string {
  if (text === '') return '0';
  const comma = text.indexOf(',');
  const integer = comma >= 0 ? text.slice(0, comma) : text;
  const rest = comma >= 0 ? text.slice(comma) : '';
  return `${integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}${rest}`;
}

/** True when the text means an amount above zero ("0", "0,", "0,00" and "" do not). */
export function isPositiveAmountText(text: string): boolean {
  return /[1-9]/.test(text);
}
