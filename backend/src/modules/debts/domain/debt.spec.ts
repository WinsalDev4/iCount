import { frenchInstallment } from '@icount/finance';

import { Debt, InvalidDebtError } from './debt.js';

const base = {
  id: 'd1',
  householdId: 'h1',
  name: 'Coche',
  kind: 'car' as const,
  principalMinor: 1_000_000,
  annualRateBps: 600,
  aprBps: null,
  startDate: '2026-01-10',
  termMonths: 24,
  currency: 'EUR',
  createdBy: 'ana',
  createdAt: new Date('2026-01-01T00:00:00Z'),
};

describe('Debt', () => {
  it('computes the French instalment when none is given', () => {
    const debt = Debt.create(base);
    expect(debt.snapshot.monthlyPaymentMinor).toBe(frenchInstallment(1_000_000, 600, 24));
  });

  it('ends exactly at the contractual term, the last instalment absorbing the rounding', () => {
    const { rows, payoffDate } = Debt.create(base).schedule();
    expect(rows).toHaveLength(24);
    expect(payoffDate).toBe('2027-12-10');
    expect(rows.at(-1)?.balanceMinor).toBe(0);
  });

  it('knows the balance owed on a date', () => {
    const debt = Debt.create(base);
    expect(debt.outstandingOn('2026-01-09')).toBe(1_000_000);
    const afterFirst = debt.schedule().rows[0]!.balanceMinor;
    expect(debt.outstandingOn('2026-01-10')).toBe(afterFirst);
    expect(debt.outstandingOn('2030-01-01')).toBe(0);
  });

  it('a larger instalment pays it off sooner', () => {
    const debt = Debt.create({ ...base, monthlyPaymentMinor: 100_000 });
    expect(debt.schedule().rows.length).toBeLessThan(24);
  });

  it('rejects instalments that never pay it off and invalid figures', () => {
    expect(() => Debt.create({ ...base, monthlyPaymentMinor: 4_000 })).toThrow(InvalidDebtError);
    expect(() => Debt.create({ ...base, principalMinor: 0 })).toThrow(InvalidDebtError);
    expect(() => Debt.create({ ...base, termMonths: 0 })).toThrow(InvalidDebtError);
    const debt = Debt.create(base);
    expect(() => debt.edit({ annualRateBps: -1 })).toThrow(InvalidDebtError);
  });
});
