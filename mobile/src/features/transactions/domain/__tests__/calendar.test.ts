import {
  addDays,
  daysInMonth,
  daysRemainingIncludingToday,
  isSameDay,
  startOfDay,
  weekDays,
} from '../calendar';

const ymd = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

describe('daysInMonth', () => {
  it.each([
    [2026, 1, 31],
    [2026, 2, 28],
    [2028, 2, 29], // leap year
    [2100, 2, 28], // divisible by 100 but not by 400: not leap
    [2000, 2, 29], // divisible by 400: leap
    [2026, 4, 30],
    [2026, 12, 31],
  ])('%i-%i has %i days', (year, month, days) => {
    expect(daysInMonth(new Date(year, month - 1, 15))).toBe(days);
  });
});

describe('daysRemainingIncludingToday', () => {
  it('counts today: the 1st of a 31-day month has 31', () => {
    expect(daysRemainingIncludingToday(new Date(2026, 9, 1))).toBe(31);
  });

  it('the last day has exactly 1', () => {
    expect(daysRemainingIncludingToday(new Date(2026, 9, 31))).toBe(1);
    expect(daysRemainingIncludingToday(new Date(2026, 3, 30))).toBe(1);
  });

  it('knows February: 28 days normally, 29 in a leap year', () => {
    expect(daysRemainingIncludingToday(new Date(2026, 1, 1))).toBe(28);
    expect(daysRemainingIncludingToday(new Date(2026, 1, 28))).toBe(1);
    expect(daysRemainingIncludingToday(new Date(2028, 1, 1))).toBe(29);
    expect(daysRemainingIncludingToday(new Date(2028, 1, 29))).toBe(1);
  });

  it('ignores the time of day', () => {
    expect(daysRemainingIncludingToday(new Date(2026, 9, 14, 23, 59))).toBe(18);
    expect(daysRemainingIncludingToday(new Date(2026, 9, 14, 0, 0))).toBe(18);
  });
});

describe('weekDays', () => {
  it('starts on Monday and has seven days', () => {
    // 14 Oct 2026 is a Wednesday.
    const week = weekDays(new Date(2026, 9, 14, 16));
    expect(week.map(ymd)).toEqual([
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
      '2026-10-15',
      '2026-10-16',
      '2026-10-17',
      '2026-10-18',
    ]);
    expect(week.every((d) => d.getHours() === 0)).toBe(true);
  });

  it('a Monday is the first day, a Sunday the last', () => {
    expect(ymd(weekDays(new Date(2026, 9, 12))[0] as Date)).toBe('2026-10-12');
    expect(ymd(weekDays(new Date(2026, 9, 18))[6] as Date)).toBe('2026-10-18');
    expect(ymd(weekDays(new Date(2026, 9, 18))[0] as Date)).toBe('2026-10-12');
  });

  it('crosses months', () => {
    // Thursday 1 Oct 2026: the week began on 28 Sep.
    expect(weekDays(new Date(2026, 9, 1)).map(ymd)).toEqual([
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ]);
  });

  it('crosses years', () => {
    // Friday 1 Jan 2027.
    const week = weekDays(new Date(2027, 0, 1)).map(ymd);
    expect(week[0]).toBe('2026-12-28');
    expect(week[6]).toBe('2027-01-03');
  });
});

describe('small helpers', () => {
  it('startOfDay drops the time', () => {
    expect(startOfDay(new Date(2026, 9, 14, 18, 30, 5))).toEqual(new Date(2026, 9, 14));
  });

  it('addDays carries months, years and goes backwards', () => {
    expect(ymd(addDays(new Date(2026, 9, 31), 1))).toBe('2026-11-01');
    expect(ymd(addDays(new Date(2026, 11, 31), 1))).toBe('2027-01-01');
    expect(ymd(addDays(new Date(2026, 2, 1), -1))).toBe('2026-02-28');
    expect(ymd(addDays(new Date(2028, 2, 1), -1))).toBe('2028-02-29');
  });

  it('isSameDay compares the calendar day, not the instant', () => {
    expect(isSameDay(new Date(2026, 9, 14, 0, 1), new Date(2026, 9, 14, 23, 59))).toBe(true);
    expect(isSameDay(new Date(2026, 9, 14, 23, 59), new Date(2026, 9, 15, 0, 1))).toBe(false);
    expect(isSameDay(new Date(2026, 9, 14), new Date(2025, 9, 14))).toBe(false);
  });
});
