import { describe, expect, it } from 'vitest';

import { addMonths, compareLocalDates, daysInMonth, parseLocalDate } from '../index.ts';

describe('calendar dates', () => {
  it('knows month lengths, leap years included', () => {
    expect([daysInMonth(2026, 2), daysInMonth(2028, 2), daysInMonth(2026, 4)]).toEqual([
      28, 29, 30,
    ]);
  });

  it('adds months keeping the anchor day and crossing years', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-02-28', 1, 31)).toBe('2026-03-31');
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
  });

  it('rejects impossible dates and compares chronologically', () => {
    expect(() => parseLocalDate('2026-02-30')).toThrow(RangeError);
    expect(() => parseLocalDate('14/10/2026')).toThrow(RangeError);
    expect(compareLocalDates('2026-09-30', '2026-10-01')).toBe(-1);
  });
});
