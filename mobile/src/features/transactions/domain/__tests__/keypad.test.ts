import { applyKey, displayAmount, isPositiveAmountText, type KeypadKey } from '../keypad';

function type(keys: string): string {
  return [...keys].reduce<string>(
    (text, key) => applyKey(text, (key === '<' ? 'delete' : key) as KeypadKey),
    '',
  );
}

describe('applyKey', () => {
  it('types digits', () => {
    expect(type('1234')).toBe('1234');
  });

  it('drops a leading zero when another digit follows', () => {
    expect(type('05')).toBe('5');
    expect(type('0005')).toBe('5');
  });

  it('keeps a single zero and ignores more zeros after it', () => {
    expect(type('0')).toBe('0');
    expect(type('000')).toBe('0');
  });

  it('starts a decimal with a leading zero when the comma comes first', () => {
    expect(type(',')).toBe('0,');
    expect(type(',5')).toBe('0,5');
  });

  it('accepts only one comma', () => {
    expect(type('1,2,3')).toBe('1,23');
    expect(type('1,,')).toBe('1,');
  });

  it('keeps zeros after the comma and stops at two decimals', () => {
    expect(type('1,05')).toBe('1,05');
    expect(type('1,0')).toBe('1,0');
    expect(type('1,999')).toBe('1,99');
  });

  it('stops at seven integer digits but still lets you type decimals', () => {
    expect(type('123456789')).toBe('1234567');
    expect(type('1234567,89')).toBe('1234567,89');
  });

  it('deletes one character at a time, including the comma', () => {
    expect(type('12,5<')).toBe('12,');
    expect(type('12,5<<')).toBe('12');
    expect(type('12,5<<<')).toBe('1');
    expect(type('1<<<<')).toBe('');
  });

  it('delete on empty text stays empty', () => {
    expect(applyKey('', 'delete')).toBe('');
  });

  it('after deleting the decimals a new comma is allowed again', () => {
    expect(type('12,5<<,')).toBe('12,');
  });

  it('typing a zero after deleting back to a single zero still behaves', () => {
    expect(type('05<0')).toBe('0');
  });
});

describe('displayAmount', () => {
  it.each([
    ['', '0'],
    ['0', '0'],
    ['7', '7'],
    ['999', '999'],
    ['1000', '1.000'],
    ['12345', '12.345'],
    ['1234567', '1.234.567'],
    ['1234,5', '1.234,5'],
    ['0,', '0,'],
    ['1234567,89', '1.234.567,89'],
  ])('shows %j as %j', (text, shown) => {
    expect(displayAmount(text)).toBe(shown);
  });
});

describe('isPositiveAmountText', () => {
  it.each([
    ['', false],
    ['0', false],
    ['0,', false],
    ['0,00', false],
    ['0,01', true],
    ['5', true],
    ['10', true],
  ])('%j → %s', (text, expected) => {
    expect(isPositiveAmountText(text)).toBe(expected);
  });
});
