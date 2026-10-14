/**
 * Rounding policy of the engine (ADR-0015): amounts are integer cents and every
 * intermediate result that produces fractions of a cent is rounded
 * half away from zero (like banks and spreadsheets do with ROUND), once per step.
 */
export function roundHalfAwayFromZero(value: number): number {
  if (!Number.isFinite(value)) throw new RangeError(`Cannot round ${value}`);
  const rounded = Math.sign(value) * Math.round(Math.abs(value));
  // Avoid -0 leaking into results and comparisons.
  return rounded === 0 ? 0 : rounded;
}

/** Throws unless `cents` is a safe integer (the engine never accepts fractions of a cent). */
export function assertCents(cents: number, name = 'amount'): number {
  if (!Number.isSafeInteger(cents)) {
    throw new RangeError(`${name} must be a safe integer number of cents, got ${cents}`);
  }
  return cents;
}
