export type ParsedRate =
  | { readonly ok: true; readonly bps: number }
  | {
      readonly ok: false;
      readonly reason: 'empty' | 'invalid' | 'too-many-decimals' | 'too-large';
    };

/**
 * An annual rate typed as a percentage → basis points, without floats: "6,9" → 690,
 * "21" → 2100, "0" → 0. Comma or dot as separator, at most two decimals, up to 100 %.
 */
export function parseRateInput(raw: string): ParsedRate {
  const text = raw.replace(/[\s%]/g, '');
  if (text === '') return { ok: false, reason: 'empty' };
  if (!/^[0-9]*[.,]?[0-9]*$/.test(text) || !/[0-9]/.test(text))
    return { ok: false, reason: 'invalid' };

  const [integer = '', decimals = ''] = text.split(/[.,]/);
  if (decimals.length > 2) return { ok: false, reason: 'too-many-decimals' };

  const bps = Number(integer || '0') * 100 + Number(decimals.padEnd(2, '0') || '0');
  if (bps > 10_000) return { ok: false, reason: 'too-large' };
  return { ok: true, bps };
}

/** 690 → "6,90 %". */
export function formatRate(bps: number): string {
  return `${(bps / 100).toFixed(2).replace('.', ',')} %`;
}
