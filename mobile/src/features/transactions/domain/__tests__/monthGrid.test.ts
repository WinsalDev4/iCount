import { buildMonthGrid, isFutureMonth, isSameMonth, monthOf, shiftMonth } from '../monthGrid';

const days = (grid: ReturnType<typeof buildMonthGrid>) =>
  grid.map((week) => week.map((cell) => (cell ? cell.getDate() : null)));

describe('buildMonthGrid', () => {
  it('starts on Monday: October 2026 begins on a Thursday', () => {
    const grid = buildMonthGrid({ year: 2026, month: 10 });
    expect(days(grid)[0]).toEqual([null, null, null, 1, 2, 3, 4]);
    expect(days(grid)[4]).toEqual([26, 27, 28, 29, 30, 31, null]);
    expect(grid).toHaveLength(5);
  });

  it('a month that starts on Monday has no leading padding', () => {
    // 1 June 2026 is a Monday.
    const first = buildMonthGrid({ year: 2026, month: 6 })[0];
    expect(first?.[0]?.getDate()).toBe(1);
  });

  it('a month that starts on Sunday pads six cells', () => {
    // 1 March 2026 is a Sunday.
    const first = days(buildMonthGrid({ year: 2026, month: 3 }))[0];
    expect(first).toEqual([null, null, null, null, null, null, 1]);
  });

  it('February 2026 (28 days, starts on Sunday) takes five weeks, February 2027 four', () => {
    expect(buildMonthGrid({ year: 2026, month: 2 })).toHaveLength(5);
    expect(buildMonthGrid({ year: 2027, month: 2 })).toHaveLength(4);
  });

  it('knows the 29th of a leap February', () => {
    const flat = days(buildMonthGrid({ year: 2028, month: 2 })).flat();
    expect(flat.filter((d) => d !== null)).toHaveLength(29);
    expect(Math.max(...flat.filter((d): d is number => d !== null))).toBe(29);
  });

  it('can need six rows', () => {
    // August 2026 starts on Saturday and has 31 days.
    expect(buildMonthGrid({ year: 2026, month: 8 })).toHaveLength(6);
  });

  it('every row has seven cells and every day appears exactly once', () => {
    for (let month = 1; month <= 12; month++) {
      const grid = buildMonthGrid({ year: 2026, month });
      expect(grid.every((week) => week.length === 7)).toBe(true);
      const real = grid.flat().filter((c) => c !== null);
      expect(new Set(real.map((d) => d?.getDate())).size).toBe(real.length);
    }
  });
});

describe('month navigation', () => {
  it('shifts forward and back across year boundaries', () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth({ year: 2026, month: 10 }, 0)).toEqual({ year: 2026, month: 10 });
  });

  it('shifts several months', () => {
    expect(shiftMonth({ year: 2026, month: 10 }, 15)).toEqual({ year: 2028, month: 1 });
    expect(shiftMonth({ year: 2026, month: 10 }, -10)).toEqual({ year: 2025, month: 12 });
  });

  it('monthOf and isSameMonth', () => {
    expect(monthOf(new Date(2026, 9, 31))).toEqual({ year: 2026, month: 10 });
    expect(isSameMonth({ year: 2026, month: 10 }, { year: 2026, month: 10 })).toBe(true);
    expect(isSameMonth({ year: 2025, month: 10 }, { year: 2026, month: 10 })).toBe(false);
  });

  it('isFutureMonth: only months after the current one', () => {
    const today = new Date(2026, 9, 14);
    expect(isFutureMonth({ year: 2026, month: 11 }, today)).toBe(true);
    expect(isFutureMonth({ year: 2027, month: 1 }, today)).toBe(true);
    expect(isFutureMonth({ year: 2026, month: 10 }, today)).toBe(false);
    expect(isFutureMonth({ year: 2026, month: 9 }, today)).toBe(false);
    expect(isFutureMonth({ year: 2025, month: 12 }, today)).toBe(false);
  });
});
