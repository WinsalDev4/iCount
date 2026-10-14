/**
 * Splits an amount of minor units (cents) among weights so that the parts ALWAYS add up to the
 * total: floor each share, then hand the leftover cents to the largest fractional remainders
 * (ties go to the earlier entry, so the result is deterministic).
 *
 * 100,00 € among thirds is 33,34 + 33,33 + 33,33, never 99,99 €. Money is never a float (ADR-0007).
 * All weights zero (or none valid) falls back to an equal split.
 */
export function allocate(totalMinor: number, weights: readonly number[]): number[] {
  if (!Number.isSafeInteger(totalMinor)) throw new RangeError('total must be a safe integer');
  if (weights.length === 0) return [];

  const clean = weights.map((w) => (Number.isFinite(w) && w > 0 ? w : 0));
  const sum = clean.reduce((a, b) => a + b, 0);
  const effective = sum > 0 ? clean : clean.map(() => 1);
  const effectiveSum = sum > 0 ? sum : effective.length;

  const sign = totalMinor < 0 ? -1 : 1;
  const abs = Math.abs(totalMinor);

  const exact = effective.map((w) => (abs * w) / effectiveSum);
  const parts = exact.map((value) => Math.floor(value));
  let leftover = abs - parts.reduce((a, b) => a + b, 0);

  const byRemainder = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const { index } of byRemainder) {
    if (leftover <= 0) break;
    parts[index] = (parts[index] ?? 0) + 1;
    leftover -= 1;
  }
  return parts.map((part) => part * sign);
}
