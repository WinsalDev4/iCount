import { Household } from '../../households/domain/household.js';
import { InvalidRecurringPaymentError, RecurringPayment } from './recurring-payment.js';

const now = new Date('2026-10-14T10:00:00Z');
const household = Household.create({
  id: 'h1',
  name: 'Casa',
  kind: 'shared',
  currency: 'EUR',
  creator: { userId: 'ana', email: 'ana@icount.app', displayName: null },
  now,
});

const base = {
  id: 'r1',
  name: 'Luz',
  kind: 'bill' as const,
  type: 'expense' as const,
  amountMinor: 6_890,
  currency: 'EUR',
  categoryId: 'bills',
  rule: { unit: 'month' as const, interval: 1, dayOfMonth: 6 },
  startDate: '2026-01-06',
  endDate: null,
  payerId: 'ana',
  shared: false,
  debtId: null,
  createdBy: 'ana',
  createdAt: now,
};

describe('RecurringPayment', () => {
  it('does not back-fill dates before today when created', () => {
    const payment = RecurringPayment.create(household, base, '2026-10-14');
    expect(payment.snapshot.nextDueDate).toBe('2026-11-06');
  });

  it('starts in the future when the start date is in the future', () => {
    const payment = RecurringPayment.create(
      household,
      { ...base, startDate: '2027-02-01' },
      '2026-10-14',
    );
    expect(payment.snapshot.nextDueDate).toBe('2027-02-06');
  });

  it('advances past a materialised date and ends with the series', () => {
    const payment = RecurringPayment.create(
      household,
      { ...base, endDate: '2026-12-31' },
      '2026-10-14',
    );

    payment.advancePast('2026-11-06');
    expect(payment.snapshot.nextDueDate).toBe('2026-12-06');
    payment.advancePast('2026-12-06');
    expect(payment.snapshot.nextDueDate).toBeNull();
  });

  it('recomputes the next date when the rule changes', () => {
    const payment = RecurringPayment.create(household, base, '2026-10-14');

    payment.edit(household, { rule: { unit: 'month', interval: 1, dayOfMonth: 20 } }, '2026-10-14');

    expect(payment.snapshot.nextDueDate).toBe('2026-10-20');
  });

  it('validates amount, payer and dates', () => {
    expect(() =>
      RecurringPayment.create(household, { ...base, amountMinor: 0 }, '2026-10-14'),
    ).toThrow(InvalidRecurringPaymentError);
    expect(() =>
      RecurringPayment.create(household, { ...base, payerId: 'stranger' }, '2026-10-14'),
    ).toThrow(InvalidRecurringPaymentError);
    expect(() =>
      RecurringPayment.create(household, { ...base, endDate: '2025-01-01' }, '2026-10-14'),
    ).toThrow(InvalidRecurringPaymentError);
  });
});
