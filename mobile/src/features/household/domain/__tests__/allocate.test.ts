import { allocate } from '../allocate';

const sum = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);

describe('allocate', () => {
  it('splits evenly when it divides exactly', () => {
    expect(allocate(10_000, [1, 1])).toEqual([5_000, 5_000]);
    expect(allocate(9_000, [1, 1, 1])).toEqual([3_000, 3_000, 3_000]);
  });

  it('hands the leftover cents out so the parts always add up', () => {
    // 100,00 € in thirds: 33,34 + 33,33 + 33,33 (never 99,99 €).
    expect(allocate(10_000, [1, 1, 1])).toEqual([3_334, 3_333, 3_333]);
    expect(allocate(1, [1, 1])).toEqual([1, 0]);
    expect(allocate(5, [1, 1, 1])).toEqual([2, 2, 1]);
  });

  it('follows the weights', () => {
    expect(allocate(10_000, [3, 1])).toEqual([7_500, 2_500]);
    expect(allocate(10_000, [200_000, 185_000])).toEqual([5_195, 4_805]);
  });

  it('gives the extra cent to the largest remainder, ties to the earlier entry', () => {
    // 1000 * 1/3 = 333.33…, 1000 * 2/3 = 666.66…: the second has the larger remainder.
    expect(allocate(1_000, [1, 2])).toEqual([333, 667]);
    expect(allocate(1, [1, 1, 1])).toEqual([1, 0, 0]);
  });

  it('handles negative totals symmetrically (refunds)', () => {
    expect(allocate(-10_000, [1, 1, 1])).toEqual([-3_334, -3_333, -3_333]);
    expect(sum(allocate(-9_999, [5, 3, 2]))).toBe(-9_999);
  });

  it('gives zero to zero-weight members', () => {
    expect(allocate(10_000, [1, 0, 1])).toEqual([5_000, 0, 5_000]);
  });

  it('falls back to an equal split when no weight is usable', () => {
    expect(allocate(10_000, [0, 0])).toEqual([5_000, 5_000]);
    expect(allocate(10_000, [Number.NaN, -3])).toEqual([5_000, 5_000]);
  });

  it('returns nothing for no members and zeros for a zero total', () => {
    expect(allocate(10_000, [])).toEqual([]);
    expect(allocate(0, [1, 2, 3])).toEqual([0, 0, 0]);
  });

  it('rejects non-integer totals instead of silently rounding', () => {
    expect(() => allocate(10.5, [1, 1])).toThrow(RangeError);
  });

  it('always adds up, for many totals and weights', () => {
    for (let total = 0; total < 400; total += 7) {
      for (const weights of [
        [1, 1],
        [1, 1, 1],
        [3, 5, 7],
        [1, 999],
        [50, 30, 20, 0],
      ]) {
        expect(sum(allocate(total, weights))).toBe(total);
      }
    }
  });
});
