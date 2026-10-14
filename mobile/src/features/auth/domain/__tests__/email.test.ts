import { isValidEmail, normalizeEmail } from '../email';

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Ana@Casa.APP ')).toBe('ana@casa.app');
  });
});

describe('isValidEmail', () => {
  it.each(['ana@casa.app', ' Ana@Casa.app ', 'a.b+tag@sub.dominio.es', 'x@y.co'])(
    'accepts %s',
    (email) => {
      expect(isValidEmail(email)).toBe(true);
    },
  );

  it.each([
    '',
    '   ',
    'ana',
    'ana@',
    '@casa.app',
    'ana@casa',
    'ana@@casa.app',
    'ana@casa..app',
    'ana@.app',
    'ana@casa.',
    'an a@casa.app',
  ])('rejects %j', (email) => {
    expect(isValidEmail(email)).toBe(false);
  });

  it('rejects absurdly long addresses', () => {
    expect(isValidEmail(`${'a'.repeat(250)}@casa.app`)).toBe(false);
  });
});
