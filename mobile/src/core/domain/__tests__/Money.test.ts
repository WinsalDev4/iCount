import { Money } from '../Money';

describe('Money', () => {
  it('adds without floating point drift', () => {
    const total = Money.ofMinor(10, 'EUR').plus(Money.ofMinor(20, 'EUR'));
    expect(total.amountMinor).toBe(30);
  });

  it('subtracts and detects negative balances', () => {
    const balance = Money.ofMinor(1_000, 'EUR').minus(Money.ofMinor(2_550, 'EUR'));
    expect(balance.amountMinor).toBe(-1_550);
    expect(balance.isNegative()).toBe(true);
  });

  it('rejects mixing currencies', () => {
    expect(() => Money.ofMinor(100, 'EUR').plus(Money.ofMinor(100, 'USD'))).toThrow(
      'Currency mismatch',
    );
  });

  it('rejects non-integer minor amounts', () => {
    expect(() => Money.ofMinor(10.5, 'EUR')).toThrow(RangeError);
  });
});
