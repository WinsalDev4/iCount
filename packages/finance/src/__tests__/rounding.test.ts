import { describe, expect, it } from 'vitest';

import { assertCents, roundHalfAwayFromZero } from '../index.ts';

describe('roundHalfAwayFromZero', () => {
  it.each([
    [0.4, 0],
    [0.5, 1],
    [1.5, 2],
    [2.5, 3],
    [-0.5, -1],
    [-2.5, -3],
    [5749.499, 5749],
  ])('rounds %d to %d', (value, expected) => {
    expect(roundHalfAwayFromZero(value)).toBe(expected);
  });

  it('never returns -0', () => {
    expect(Object.is(roundHalfAwayFromZero(-0.4), 0)).toBe(true);
  });

  it('rejects non-finite values', () => {
    expect(() => roundHalfAwayFromZero(Number.NaN)).toThrow(RangeError);
    expect(() => roundHalfAwayFromZero(Infinity)).toThrow(RangeError);
  });
});

describe('assertCents', () => {
  it('accepts safe integers and rejects fractions of a cent', () => {
    expect(assertCents(864_000)).toBe(864_000);
    expect(() => assertCents(10.5, 'principal')).toThrow('principal must be a safe integer');
  });
});
