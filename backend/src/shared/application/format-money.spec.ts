import { formatMoney } from './format-money.js';

// Intl separates the amount and the symbol with a no-break space.
const normalise = (text: string) => text.replace(/\s/g, ' ');

describe('formatMoney', () => {
  it.each([
    [1_234, '12,34 €'],
    [5, '0,05 €'],
    [123_456_789, '1.234.567,89 €'],
    [-2_500, '-25,00 €'],
    [0, '0,00 €'],
  ])('%i cents → %s', (minor, expected) => {
    expect(normalise(formatMoney(minor, 'EUR'))).toBe(expected);
  });
});
