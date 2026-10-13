import { roundHalfAwayFromZero } from '@icount/finance';

/** Proves the finance engine resolves and runs inside the app's toolchain (offline simulations). */
describe('@icount/finance in the app', () => {
  it('can be imported', () => {
    expect(roundHalfAwayFromZero(2.5)).toBe(3);
  });
});
