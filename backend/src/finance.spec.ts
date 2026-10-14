import { roundHalfAwayFromZero } from '@icount/finance';

/** Proves the finance engine resolves and runs inside the backend toolchain. */
describe('@icount/finance in the backend', () => {
  it('can be imported', () => {
    expect(roundHalfAwayFromZero(-2.5)).toBe(-3);
  });
});
