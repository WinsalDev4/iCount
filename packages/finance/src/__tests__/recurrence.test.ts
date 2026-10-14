import { describe, expect, it } from 'vitest';

import { nextOccurrence, occurrencesBetween, type RecurrenceRule } from '../index.ts';

const monthly = (dayOfMonth: number, interval = 1): RecurrenceRule => ({
  unit: 'month',
  interval,
  dayOfMonth,
});

describe('occurrencesBetween', () => {
  it('falls on the last day of shorter months and goes back to 31 afterwards', () => {
    expect(occurrencesBetween(monthly(31), '2026-01-15', null, '2026-01-01', '2026-05-31')).toEqual(
      ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31'],
    );
  });

  it('skips the first month when its date is before the start', () => {
    expect(occurrencesBetween(monthly(5), '2026-10-14', null, '2026-10-01', '2027-01-31')).toEqual([
      '2026-11-05',
      '2026-12-05',
      '2027-01-05',
    ]);
  });

  it('supports every N months, yearly rules and leap years', () => {
    expect(
      occurrencesBetween(monthly(29, 3), '2026-11-29', null, '2026-01-01', '2027-12-31'),
    ).toEqual(['2026-11-29', '2027-02-28', '2027-05-29', '2027-08-29', '2027-11-29']);
    const leapDay: RecurrenceRule = { unit: 'year', interval: 1, dayOfMonth: 29, monthOfYear: 2 };
    expect(occurrencesBetween(leapDay, '2026-01-01', null, '2026-01-01', '2029-12-31')).toEqual([
      '2026-02-28',
      '2027-02-28',
      '2028-02-29',
      '2029-02-28',
    ]);
  });

  it('stops at the end date and only returns dates inside the window', () => {
    expect(
      occurrencesBetween(monthly(1), '2026-01-01', '2026-04-15', '2026-02-01', '2026-12-31'),
    ).toEqual(['2026-02-01', '2026-03-01', '2026-04-01']);
  });

  it('rejects invalid rules', () => {
    expect(() =>
      occurrencesBetween(monthly(1, 0), '2026-01-01', null, '2026-01-01', '2026-12-31'),
    ).toThrow(RangeError);
    expect(() =>
      occurrencesBetween(
        { unit: 'year', interval: 1, dayOfMonth: 1 },
        '2026-01-01',
        null,
        '2026-01-01',
        '2026-12-31',
      ),
    ).toThrow(RangeError);
  });
});

describe('nextOccurrence', () => {
  it('finds the next due date, including today, and null after the end', () => {
    expect(nextOccurrence(monthly(6), '2026-01-06', null, '2026-10-06')).toBe('2026-10-06');
    expect(nextOccurrence(monthly(6), '2026-01-06', null, '2026-10-07')).toBe('2026-11-06');
    expect(nextOccurrence(monthly(6), '2026-01-06', '2026-10-31', '2026-10-07')).toBeNull();
  });
});
