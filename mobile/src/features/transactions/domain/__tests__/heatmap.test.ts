import { Money } from '@/core/domain/Money';

import { intensityByDay, intensityOf } from '../heatmap';
import type { DailyTotal } from '../Transaction';

const eur = (cents: number) => Money.ofMinor(cents, 'EUR');
const day = (d: number, expenses: number): DailyTotal => ({
  date: new Date(2026, 9, d),
  income: eur(0),
  expenses: eur(expenses),
});

describe('intensityOf', () => {
  it('a day without spending is level 0 whatever the rest of the month did', () => {
    expect(intensityOf(0, [100, 200, 300])).toBe(0);
    expect(intensityOf(-5, [100])).toBe(0);
  });

  it('with no spending days at all there is nothing to compare: 0', () => {
    expect(intensityOf(100, [])).toBe(0);
    expect(intensityOf(100, [0, 0])).toBe(0);
  });

  it('splits the days into four quartiles, lowest to highest', () => {
    const month = [100, 200, 300, 400, 500, 600, 700, 800];
    const levels = month.map((v) => intensityOf(v, month));
    expect(levels).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
  });

  it('a single spending day, or days that all spent the same, sit in the middle', () => {
    expect(intensityOf(500, [500])).toBe(3);
    expect(intensityOf(500, [500, 500, 500, 500])).toBe(3);
  });

  it('ties share their place instead of splitting arbitrarily', () => {
    const month = [100, 100, 100, 900];
    expect(intensityOf(100, month)).toBe(2); // the cheap group, lower middle
    expect(intensityOf(900, month)).toBe(4);
  });

  it('ignores zero-spending days when ranking', () => {
    expect(intensityOf(300, [0, 0, 0, 100, 300])).toBe(intensityOf(300, [100, 300]));
  });

  it('always returns a level between 1 and 4 for a spending day', () => {
    const values = [1, 5, 9, 9, 10, 250, 99_999];
    for (const v of values) {
      const level = intensityOf(v, values);
      expect(level).toBeGreaterThanOrEqual(1);
      expect(level).toBeLessThanOrEqual(4);
    }
  });

  it('is monotonic: spending more never lowers the level', () => {
    const month = [10, 40, 90, 150, 300, 301, 1_000];
    const levels = month.map((v) => intensityOf(v, month));
    expect([...levels].sort()).toEqual(levels);
  });
});

describe('intensityByDay', () => {
  it("maps the day number to its level using only that month's expenses", () => {
    const map = intensityByDay([day(1, 100), day(2, 0), day(3, 900)]);
    expect(map.get(1)).toBe(2);
    expect(map.get(2)).toBe(0);
    expect(map.get(3)).toBe(4);
    expect(map.get(4)).toBeUndefined();
  });

  it('is empty for a month without movements', () => {
    expect(intensityByDay([]).size).toBe(0);
  });
});
