import { parseAmountInput } from '../parseAmountInput';

function cents(raw: string): number | string {
  const parsed = parseAmountInput(raw);
  return parsed.ok ? parsed.amount.amountMinor : parsed.reason;
}

describe('parseAmountInput', () => {
  it.each([
    ['12', 1200],
    ['0', 0],
    ['12,5', 1250],
    ['12,50', 1250],
    ['12,', 1200],
    [',5', 50],
    ['0,05', 5],
    ['1.234,56', 123456],
    ['1,234.56', 123456],
    ['1234.56', 123456],
    ['12.5', 1250],
    ['1.234', 123400],
    ['999.999', 99999900],
    ['1.234.567', 123456700],
    ['1.234.567,89', 123456789],
    ['12 €', 1200],
    ['  3 450,10 € ', 345010],
    ['007', 700],
  ])('reads %j as %i cents', (raw, expected) => {
    expect(cents(raw)).toBe(expected);
  });

  it('returns Money in the requested currency', () => {
    const parsed = parseAmountInput('5', 'USD');
    expect(parsed.ok && parsed.amount.currency).toBe('USD');
  });

  it.each(['', '   ', '€'])('says %j is empty or unusable', (raw) => {
    expect(['empty', 'invalid']).toContain(cents(raw));
  });

  it.each(['abc', '12a', '1 2 x', '--5', '-5', '+5', '12;5', '.', ',', '..', ',,'])(
    'rejects %j as invalid',
    (raw) => {
      expect(cents(raw)).toBe('invalid');
    },
  );

  it.each(['1.2.3', '12.345.6', '1,2,3', '1.234,5.6', '1,234,567', '1.23.456'])(
    'rejects malformed grouping %j',
    (raw) => {
      expect(cents(raw)).toBe('invalid');
    },
  );

  it.each(['12,345', '1,234', '12,999', '1234.5678', '0,001'])(
    'rejects more than two decimals in %j',
    (raw) => {
      expect(cents(raw)).toBe('too-many-decimals');
    },
  );

  it('rejects amounts that are absurdly large', () => {
    expect(cents('1.000.000.000')).toBe('too-large');
    expect(cents('99999999999999999999')).toBe('too-large');
  });

  it('accepts the largest supported amount', () => {
    expect(cents('999.999.999,99')).toBe(99_999_999_999);
  });

  it('never loses a cent to floating point', () => {
    // 0.1 + 0.2 style traps: values that are not exact in binary.
    expect(cents('0,29')).toBe(29);
    expect(cents('1,15')).toBe(115);
    expect(cents('4,35')).toBe(435);
    expect(cents('19,99')).toBe(1999);
  });
});
