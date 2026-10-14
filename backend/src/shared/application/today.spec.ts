import { startOfDayIn, todayIn } from './today.js';

describe('today', () => {
  it('is the calendar day in Spain, not in UTC', () => {
    const lateNightUtc = new Date('2026-10-14T23:30:00Z'); // 01:30 on the 15th in Madrid
    expect(todayIn({ now: () => lateNightUtc })()).toBe('2026-10-15');
  });

  it('knows when a day starts in Madrid, summer and winter time', () => {
    expect(startOfDayIn('2026-07-01').toISOString()).toBe('2026-06-30T22:00:00.000Z');
    expect(startOfDayIn('2026-12-01').toISOString()).toBe('2026-11-30T23:00:00.000Z');
  });
});
