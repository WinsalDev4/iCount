import { Money } from '@/core/domain/Money';

import { computeDailyAllowance } from '../dailyAllowance';

const eur = (cents: number) => Money.ofMinor(cents, 'EUR');
const compute = (balance: number, spentToday: number, today: Date) =>
  computeDailyAllowance({ monthBalance: eur(balance), spentToday: eur(spentToday), today });

describe('computeDailyAllowance', () => {
  it('shares the money left evenly over the days left, today included', () => {
    // 14 Oct → 18 days left. 1.800,00 € / 18 = 100,00 € a day.
    const result = compute(180_000, 0, new Date(2026, 9, 14));
    expect(result.daysRemaining).toBe(18);
    expect(result.dailyAllowance.amountMinor).toBe(10_000);
    expect(result.leftToday.amountMinor).toBe(10_000);
    expect(result.status).toBe('on-track');
  });

  it('rounds DOWN to the cent: it never promises money that is not there', () => {
    // 1.000,00 € over 18 days = 55,555… → 55,55.
    expect(compute(100_000, 0, new Date(2026, 9, 14)).dailyAllowance.amountMinor).toBe(5_555);
    // 1 cent over 18 days = nothing per day.
    expect(compute(1, 0, new Date(2026, 9, 14)).dailyAllowance.amountMinor).toBe(0);
  });

  it('what you spent today is part of the money of the day, not a loss for the other days', () => {
    // The balance (1.700 €) already includes today's 100 € expense: the day started with 1.800 €.
    const result = compute(170_000, 10_000, new Date(2026, 9, 14));
    expect(result.dailyAllowance.amountMinor).toBe(10_000);
    expect(result.spentToday.amountMinor).toBe(10_000);
    expect(result.leftToday.amountMinor).toBe(0);
    expect(result.status).toBe('on-track');
  });

  it('spending part of the day leaves the rest', () => {
    const result = compute(175_800, 4_200, new Date(2026, 9, 14)); // started with 1.800 €
    expect(result.leftToday.amountMinor).toBe(5_800);
  });

  it('going past today\'s share is "over-today" with a negative remainder', () => {
    const result = compute(150_000, 30_000, new Date(2026, 9, 14)); // started with 1.800 €
    expect(result.dailyAllowance.amountMinor).toBe(10_000);
    expect(result.leftToday.amountMinor).toBe(-20_000);
    expect(result.status).toBe('over-today');
  });

  describe('last day of the month', () => {
    it('all the money left is for today', () => {
      const result = compute(34_567, 0, new Date(2026, 9, 31));
      expect(result.daysRemaining).toBe(1);
      expect(result.dailyAllowance.amountMinor).toBe(34_567);
    });

    it('works on the 30th, 28th and 29th too', () => {
      expect(compute(5_000, 0, new Date(2026, 3, 30)).dailyAllowance.amountMinor).toBe(5_000);
      expect(compute(5_000, 0, new Date(2026, 1, 28)).dailyAllowance.amountMinor).toBe(5_000);
      expect(compute(5_000, 0, new Date(2028, 1, 29)).dailyAllowance.amountMinor).toBe(5_000);
    });
  });

  describe('February', () => {
    it('divides by 28 days on the 1st of a normal February…', () => {
      expect(compute(280_000, 0, new Date(2026, 1, 1)).dailyAllowance.amountMinor).toBe(10_000);
    });

    it('…and by 29 in a leap year', () => {
      expect(compute(290_000, 0, new Date(2028, 1, 1)).dailyAllowance.amountMinor).toBe(10_000);
      expect(compute(290_000, 0, new Date(2028, 1, 1)).daysRemaining).toBe(29);
    });

    it('the 1st of March has 31 days again', () => {
      expect(compute(310_000, 0, new Date(2026, 2, 1)).dailyAllowance.amountMinor).toBe(10_000);
    });
  });

  describe('negative or empty balance', () => {
    it('a negative balance has no allowance (nothing to share) and is a deficit', () => {
      const result = compute(-25_000, 0, new Date(2026, 9, 14));
      expect(result.dailyAllowance.amountMinor).toBe(0);
      expect(result.leftToday.amountMinor).toBe(0);
      expect(result.status).toBe('month-in-deficit');
      expect(result.monthBalance.amountMinor).toBe(-25_000);
    });

    it('a zero balance is also nothing to share', () => {
      const result = compute(0, 0, new Date(2026, 9, 14));
      expect(result.dailyAllowance.amountMinor).toBe(0);
      expect(result.status).toBe('month-in-deficit');
    });

    it("a deficit created by today's spending shows how much of today went over", () => {
      // The month had 50 € at the start of today and 80 € was spent: balance −30 €.
      const result = compute(-3_000, 8_000, new Date(2026, 9, 14));
      expect(result.dailyAllowance.amountMinor).toBe(277); // 50 € / 18 days, rounded down
      expect(result.leftToday.amountMinor).toBe(277 - 8_000);
      expect(result.status).toBe('over-today');
    });
  });

  it('keeps the currency', () => {
    const result = computeDailyAllowance({
      monthBalance: Money.ofMinor(10_000, 'USD'),
      spentToday: Money.zero('USD'),
      today: new Date(2026, 9, 14),
    });
    expect(result.dailyAllowance.currency).toBe('USD');
  });

  it('the allowance times the days never exceeds the money (no cent invented)', () => {
    for (const balance of [1, 99, 1_000, 12_345, 99_999, 1_234_567]) {
      for (const day of [1, 10, 14, 28, 31]) {
        const result = compute(balance, 0, new Date(2026, 9, day));
        expect(result.dailyAllowance.amountMinor * result.daysRemaining).toBeLessThanOrEqual(
          balance,
        );
      }
    }
  });
});
