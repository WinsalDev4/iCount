import { isValidHouseholdName, normalizeHouseholdName } from '../householdName';
import { formatInviteCode, isValidInviteCode, normalizeInviteCode } from '../inviteCode';

describe('invite codes', () => {
  it('normalizes what people type: case, spaces and dashes', () => {
    expect(normalizeInviteCode(' abcd-2345 ')).toBe('ABCD2345');
    expect(normalizeInviteCode('ab cd 23 45')).toBe('ABCD2345');
  });

  it.each(['ABCD2345', 'abcd-2345', 'ABCD 2345', 'A1B2C3D4'])('accepts %j', (code) => {
    expect(isValidInviteCode(code)).toBe(true);
  });

  it.each(['', 'ABC', 'ABCD234', 'ABCD23456', 'ABCD-23_5', 'ABCD234!', 'ÁBCD2345'])(
    'rejects %j',
    (code) => {
      expect(isValidInviteCode(code)).toBe(false);
    },
  );

  it('formats a code in two halves to read it aloud', () => {
    expect(formatInviteCode('abcd2345')).toBe('ABCD-2345');
    expect(formatInviteCode('ABCD-2345')).toBe('ABCD-2345');
  });
});

describe('household names', () => {
  it('collapses whitespace', () => {
    expect(normalizeHouseholdName('  Casa   Ana  &  Leo ')).toBe('Casa Ana & Leo');
  });

  it('accepts 1 to 60 characters and nothing else', () => {
    expect(isValidHouseholdName('A')).toBe(true);
    expect(isValidHouseholdName('a'.repeat(60))).toBe(true);
    expect(isValidHouseholdName('a'.repeat(61))).toBe(false);
    expect(isValidHouseholdName('')).toBe(false);
    expect(isValidHouseholdName('    ')).toBe(false);
  });
});
