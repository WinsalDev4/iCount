import type { CategoryId } from '@/core/domain/Category';
import { Money } from '@/core/domain/Money';

import type { UpcomingDue } from '../RecurringPayment';
import {
  describeRule,
  dueDatesBetween,
  frequencyOf,
  nextDueDate,
  ruleFor,
  ruleWithFrequency,
} from '../recurrenceMath';
import { MAX_REMINDERS, planReminders } from '../reminderPlans';

const ymd = (d: Date | null) =>
  d
    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    : null;

const monthly31 = {
  rule: { unit: 'month', interval: 1, dayOfMonth: 31 } as const,
  startDate: new Date(2026, 0, 31),
  endDate: null,
};

describe('dueDatesBetween', () => {
  it('falls on the last day of shorter months and comes back to the 31st', () => {
    const dates = dueDatesBetween(monthly31, new Date(2026, 0, 1), new Date(2026, 3, 30)).map(ymd);
    expect(dates).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  });

  it('uses the 29th in a leap February', () => {
    const dates = dueDatesBetween(
      { ...monthly31, startDate: new Date(2028, 0, 31) },
      new Date(2028, 1, 1),
      new Date(2028, 1, 29),
    ).map(ymd);
    expect(dates).toEqual(['2028-02-29']);
  });

  it('does not go before the start date nor after the end date', () => {
    const series = {
      rule: { unit: 'month', interval: 1, dayOfMonth: 5 } as const,
      startDate: new Date(2026, 2, 5),
      endDate: new Date(2026, 4, 5),
    };
    expect(dueDatesBetween(series, new Date(2026, 0, 1), new Date(2026, 11, 31)).map(ymd)).toEqual([
      '2026-03-05',
      '2026-04-05',
      '2026-05-05',
    ]);
  });

  it('every three months and every year', () => {
    const quarterly = {
      rule: { unit: 'month', interval: 3, dayOfMonth: 10 } as const,
      startDate: new Date(2026, 0, 10),
      endDate: null,
    };
    expect(
      dueDatesBetween(quarterly, new Date(2026, 0, 1), new Date(2026, 11, 31)).map(ymd),
    ).toEqual(['2026-01-10', '2026-04-10', '2026-07-10', '2026-10-10']);

    const yearly = {
      rule: { unit: 'year', interval: 1, dayOfMonth: 20, monthOfYear: 3 } as const,
      startDate: new Date(2025, 2, 20),
      endDate: null,
    };
    expect(dueDatesBetween(yearly, new Date(2026, 0, 1), new Date(2027, 11, 31)).map(ymd)).toEqual([
      '2026-03-20',
      '2027-03-20',
    ]);
  });
});

describe('nextDueDate', () => {
  it('counts today as due and rolls to the next month afterwards', () => {
    const series = { ...monthly31, rule: { ...monthly31.rule, dayOfMonth: 14 } };
    expect(ymd(nextDueDate(series, new Date(2026, 9, 14)))).toBe('2026-10-14');
    expect(ymd(nextDueDate(series, new Date(2026, 9, 15)))).toBe('2026-11-14');
  });

  it('is null once the series ended', () => {
    const series = { ...monthly31, endDate: new Date(2026, 5, 30) };
    expect(nextDueDate(series, new Date(2026, 6, 1))).toBeNull();
  });
});

describe('describeRule', () => {
  it('reads like a sentence', () => {
    expect(describeRule({ unit: 'month', interval: 1, dayOfMonth: 5 })).toBe('cada mes, el día 5');
    expect(describeRule({ unit: 'month', interval: 3, dayOfMonth: 31 })).toBe(
      'cada 3 meses, el último día',
    );
    expect(describeRule({ unit: 'year', interval: 1, dayOfMonth: 15, monthOfYear: 6 })).toBe(
      'cada año, el 15 de junio',
    );
    expect(describeRule({ unit: 'month', interval: 2, dayOfMonth: 1 })).toBe(
      'cada 2 meses, el día 1',
    );
  });
});

describe('frequencies', () => {
  it('builds the rule from the first due date', () => {
    expect(ruleFor('monthly', new Date(2026, 9, 14))).toEqual({
      unit: 'month',
      interval: 1,
      dayOfMonth: 14,
    });
    expect(ruleFor('yearly', new Date(2026, 9, 14))).toEqual({
      unit: 'year',
      interval: 1,
      dayOfMonth: 14,
      monthOfYear: 10,
    });
    expect(ruleFor('quarterly', new Date(2026, 0, 31)).interval).toBe(3);
    expect(ruleFor('biannual', new Date(2026, 0, 31)).interval).toBe(6);
  });

  it('recognises the stored rule, or none for a custom one', () => {
    expect(frequencyOf({ unit: 'month', interval: 1, dayOfMonth: 1 })).toBe('monthly');
    expect(frequencyOf({ unit: 'month', interval: 3, dayOfMonth: 1 })).toBe('quarterly');
    expect(frequencyOf({ unit: 'month', interval: 6, dayOfMonth: 1 })).toBe('biannual');
    expect(frequencyOf({ unit: 'year', interval: 1, dayOfMonth: 1, monthOfYear: 4 })).toBe(
      'yearly',
    );
    expect(frequencyOf({ unit: 'month', interval: 2, dayOfMonth: 1 })).toBeNull();
    expect(frequencyOf({ unit: 'year', interval: 2, dayOfMonth: 1, monthOfYear: 4 })).toBeNull();
  });

  it('changing the periodicity keeps the day (a 31 stays the last day)', () => {
    const monthly = { unit: 'month', interval: 1, dayOfMonth: 31 } as const;
    expect(ruleWithFrequency(monthly, 'quarterly', 5)).toEqual({
      unit: 'month',
      interval: 3,
      dayOfMonth: 31,
    });
    expect(ruleWithFrequency(monthly, 'yearly', 5)).toEqual({
      unit: 'year',
      interval: 1,
      dayOfMonth: 31,
      monthOfYear: 5,
    });
    const yearly = { unit: 'year', interval: 1, dayOfMonth: 20, monthOfYear: 3 } as const;
    expect(ruleWithFrequency(yearly, 'monthly', 9)).toEqual({
      unit: 'month',
      interval: 1,
      dayOfMonth: 20,
    });
    expect(ruleWithFrequency(yearly, 'yearly', 9).monthOfYear).toBe(3);
  });
});

describe('planReminders', () => {
  const due = (
    id: string,
    day: Date,
    type: 'income' | 'expense' = 'expense',
    cents = 1_299,
  ): UpcomingDue => ({
    recurringPaymentId: id,
    name: `Pago ${id}`,
    dueDate: day,
    type,
    amount: Money.ofMinor(cents, 'EUR'),
    categoryId: 'bills' as CategoryId,
  });
  const now = new Date(2026, 9, 14, 10);

  it('fires at 09:00 the day before, for expenses only', () => {
    const plans = planReminders(
      [due('a', new Date(2026, 9, 20)), due('salary', new Date(2026, 9, 28), 'income')],
      now,
    );
    expect(plans).toHaveLength(1);
    expect(plans[0]?.fireAt).toEqual(new Date(2026, 9, 19, 9));
    expect(plans[0]?.title).toBe('Mañana vence un pago');
    expect(plans[0]?.body).toContain('Pago a');
    expect(plans[0]?.body).toContain('12,99');
    expect(plans[0]?.url).toBe('/recurring');
  });

  it('skips reminders whose time already passed', () => {
    const plans = planReminders(
      [
        due('today', new Date(2026, 9, 14)),
        due('tomorrow', new Date(2026, 9, 15)), // would fire today at 09:00, already past
        due('later', new Date(2026, 9, 16)),
      ],
      now,
    );
    expect(plans.map((p) => p.id.split(':')[0])).toEqual(['later']);
  });

  it('crosses a month boundary and keeps a stable id per payment and day', () => {
    const [plan] = planReminders([due('a', new Date(2026, 10, 1))], now);
    expect(plan?.fireAt).toEqual(new Date(2026, 9, 31, 9));
    expect(plan?.id).toBe('a:2026-11-1');
  });

  it('orders by time and keeps at most the cap', () => {
    const dues = Array.from({ length: MAX_REMINDERS + 10 }, (_, i) =>
      due(`p${i}`, new Date(2026, 10, 1 + (i % 28))),
    );
    const plans = planReminders(dues.reverse(), now);
    expect(plans).toHaveLength(MAX_REMINDERS);
    const times = plans.map((p) => p.fireAt.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });
});
