import type { CategoryId } from '@/core/domain/Category';
import { Money } from '@/core/domain/Money';

import { RecurringError } from '../../domain/RecurringError';
import type { NewRecurringPayment } from '../../domain/RecurringPayment';
import { InMemoryRecurringRepository } from '../InMemoryRecurringRepository';

const NOW = new Date(2026, 9, 14, 10);
const ymd = (d: Date | null) =>
  d
    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    : null;

const rent: NewRecurringPayment = {
  householdId: 'h1',
  name: 'Alquiler',
  kind: 'bill',
  type: 'expense',
  amount: Money.ofMinor(75_000, 'EUR'),
  categoryId: 'housing' as CategoryId,
  rule: { unit: 'month', interval: 1, dayOfMonth: 1 },
  startDate: new Date(2026, 0, 1),
  shared: true,
};

const repo = (seed = false) =>
  new InMemoryRecurringRepository({ payments: [], seedDemoData: seed, now: () => NOW });

describe('InMemoryRecurringRepository', () => {
  it('creates a payment with its next due date and the signed-in payer', async () => {
    const created = await repo().create(rent);
    expect(created.id).toMatch(/^recurring-/);
    expect(ymd(created.nextDueDate)).toBe('2026-11-01');
    expect(created.endDate).toBeNull();
    expect(created.debtId).toBeNull();
    expect(created.payerId).toBeTruthy();
    expect(created.shared).toBe(true);
  });

  it('lists only the household payments', async () => {
    const r = repo();
    await r.create(rent);
    await r.create({ ...rent, householdId: 'h2', name: 'Otro hogar' });
    expect((await r.list('h1')).map((p) => p.name)).toEqual(['Alquiler']);
  });

  it('a payment that ended has no next due date', async () => {
    const created = await repo().create({ ...rent, endDate: new Date(2026, 5, 1) });
    expect(created.nextDueDate).toBeNull();
  });

  it('updates fields and recomputes the next due date from a new rule', async () => {
    const r = repo();
    const { id } = await r.create(rent);
    const updated = await r.update(id, {
      name: 'Alquiler nuevo',
      amount: Money.ofMinor(80_000, 'EUR'),
      rule: { unit: 'month', interval: 3, dayOfMonth: 1 },
      shared: false,
    });
    expect(updated).toMatchObject({ name: 'Alquiler nuevo', shared: false });
    expect(updated.amount.amountMinor).toBe(80_000);
    // Every 3 months from January: 1 Jan, 1 Apr, 1 Jul, 1 Oct, 1 Jan 2027.
    expect(ymd(updated.nextDueDate)).toBe('2027-01-01');
    expect((await r.list('h1'))[0]?.name).toBe('Alquiler nuevo');
  });

  it('can end a payment with an end date', async () => {
    const r = repo();
    const { id } = await r.create(rent);
    expect((await r.update(id, { endDate: new Date(2026, 8, 1) })).nextDueDate).toBeNull();
  });

  it('deletes, and complains about what does not exist', async () => {
    const r = repo();
    const { id } = await r.create(rent);
    await r.delete(id);
    expect(await r.list('h1')).toEqual([]);
    await expect(r.delete(id)).rejects.toEqual(new RecurringError('not-found'));
    await expect(r.update('nope', { name: 'x' })).rejects.toEqual(new RecurringError('not-found'));
  });

  it('forecasts the occurrences of every payment in a range, soonest first', async () => {
    const r = repo();
    await r.create(rent);
    await r.create({
      ...rent,
      name: 'Netflix',
      amount: Money.ofMinor(1_299, 'EUR'),
      rule: { unit: 'month', interval: 1, dayOfMonth: 15 },
    });
    const dues = await r.upcoming('h1', new Date(2026, 9, 14), new Date(2026, 10, 20));
    expect(dues.map((d) => `${ymd(d.dueDate)} ${d.name}`)).toEqual([
      '2026-10-15 Netflix',
      '2026-11-01 Alquiler',
      '2026-11-15 Netflix',
    ]);
    expect(dues[0]).toMatchObject({ type: 'expense' });
  });

  it('seeds a few sample payments the first time a household is read', async () => {
    const r = new InMemoryRecurringRepository({ now: () => NOW });
    const payments = await r.list('h1');
    expect(payments.length).toBeGreaterThanOrEqual(4);
    expect(payments.some((p) => p.type === 'income')).toBe(true);
    expect(payments.every((p) => p.nextDueDate !== null)).toBe(true);
    expect(await r.list('h1')).toHaveLength(payments.length); // not seeded twice
    expect((await r.upcoming('h1', NOW, new Date(2026, 10, 30))).length).toBeGreaterThan(0);
  });
});
