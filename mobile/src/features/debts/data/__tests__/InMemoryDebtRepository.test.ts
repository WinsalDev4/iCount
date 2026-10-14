import { Money } from '@/core/domain/Money';

import type { NewDebt } from '../../domain/Debt';
import { InMemoryDebtRepository } from '../InMemoryDebtRepository';

const eur = (cents: number) => Money.ofMinor(cents, 'EUR');
const NOW = new Date(2026, 9, 14);

const loan = (extra: Partial<NewDebt> = {}): NewDebt => ({
  householdId: 'h1',
  name: 'Coche',
  kind: 'car',
  principal: eur(1_200_000),
  annualRateBps: 690,
  startDate: new Date(2025, 9, 15), // first instalment a year ago
  termMonths: 60,
  ...extra,
});

const make = () => new InMemoryDebtRepository({ debts: [], now: () => NOW });

describe('InMemoryDebtRepository', () => {
  describe('create', () => {
    it('computes the French instalment when none is given', async () => {
      const debt = await make().create(loan());
      // 12.000 € at 6,90 % over 60 months: about 237 € a month.
      expect(debt.monthlyPayment.amountMinor).toBeGreaterThan(23_500);
      expect(debt.monthlyPayment.amountMinor).toBeLessThan(23_900);
    });

    it('respects an explicit instalment', async () => {
      const debt = await make().create(loan({ monthlyPayment: eur(30_000) }));
      expect(debt.monthlyPayment.amountMinor).toBe(30_000);
      // Paying more than the contractual instalment ends the debt sooner.
      const contractual = await make().create(loan());
      expect(debt.endDate.getTime()).toBeLessThan(contractual.endDate.getTime());
    });

    it('derives the balance from the instalments already due', async () => {
      const debt = await make().create(loan());
      expect(debt.outstanding.amountMinor).toBeLessThan(debt.principal.amountMinor);
      expect(debt.outstanding.amountMinor).toBeGreaterThan(900_000);
    });

    it('before the first instalment the whole principal is owed', async () => {
      const debt = await make().create(loan({ startDate: new Date(2026, 11, 1) }));
      expect(debt.outstanding.amountMinor).toBe(1_200_000);
    });

    it('a debt with all its instalments in the past is paid off', async () => {
      const debt = await make().create(loan({ startDate: new Date(2020, 0, 1), termMonths: 12 }));
      expect(debt.outstanding.amountMinor).toBe(0);
    });

    it('the end date is the date of the last instalment', async () => {
      const debt = await make().create(loan({ startDate: new Date(2026, 0, 31), termMonths: 12 }));
      expect(debt.endDate).toEqual(new Date(2026, 11, 31));
    });

    it('refuses an instalment that does not even cover the monthly interest', async () => {
      await expect(
        make().create(loan({ principal: eur(10_000_000), monthlyPayment: eur(1_000) })),
      ).rejects.toMatchObject({ reason: 'invalid' });
    });

    it('works with a 0 % rate', async () => {
      const debt = await make().create(
        loan({ annualRateBps: 0, principal: eur(120_000), termMonths: 12 }),
      );
      expect(debt.monthlyPayment.amountMinor).toBe(10_000);
    });

    it('gives every debt its own id', async () => {
      const repository = make();
      const a = await repository.create(loan());
      const b = await repository.create(loan({ name: 'Otra' }));
      expect(a.id).not.toBe(b.id);
    });
  });

  describe('list / getById / delete', () => {
    it('lists by household', async () => {
      const repository = make();
      await repository.create(loan());
      await repository.create(loan({ householdId: 'h2' }));
      expect(await repository.list('h1')).toHaveLength(1);
      expect(await repository.list('h3')).toEqual([]);
    });

    it('finds by id or returns null', async () => {
      const repository = make();
      const debt = await repository.create(loan());
      expect((await repository.getById(debt.id))?.name).toBe('Coche');
      expect(await repository.getById('nope')).toBeNull();
    });

    it('deletes and complains about unknown ids', async () => {
      const repository = make();
      const debt = await repository.create(loan());
      await repository.delete(debt.id);
      expect(await repository.list('h1')).toEqual([]);
      await expect(repository.delete(debt.id)).rejects.toMatchObject({ reason: 'not-found' });
    });
  });

  describe('update', () => {
    it('renames without touching the money', async () => {
      const repository = make();
      const debt = await repository.create(loan());
      const updated = await repository.update(debt.id, { name: 'Coche nuevo', kind: 'other' });
      expect(updated).toMatchObject({ name: 'Coche nuevo', kind: 'other' });
      expect(updated.monthlyPayment.amountMinor).toBe(debt.monthlyPayment.amountMinor);
    });

    it('changing the rate or the term recomputes the instalment', async () => {
      const repository = make();
      const debt = await repository.create(loan());
      const longer = await repository.update(debt.id, { termMonths: 120 });
      expect(longer.monthlyPayment.amountMinor).toBeLessThan(debt.monthlyPayment.amountMinor);
      const cheaper = await repository.update(debt.id, { annualRateBps: 300 });
      expect(cheaper.monthlyPayment.amountMinor).toBeLessThan(longer.monthlyPayment.amountMinor);
    });

    it('an explicit new instalment wins', async () => {
      const repository = make();
      const debt = await repository.create(loan());
      const updated = await repository.update(debt.id, {
        termMonths: 120,
        monthlyPayment: eur(40_000),
      });
      expect(updated.monthlyPayment.amountMinor).toBe(40_000);
    });

    it('can clear or set the APR', async () => {
      const repository = make();
      const debt = await repository.create(loan({ aprBps: 700 }));
      expect(debt.aprBps).toBe(700);
      expect((await repository.update(debt.id, { aprBps: undefined, name: 'x' })).aprBps).toBe(700);
    });

    it('keeps the stored debt unchanged when the update is refused', async () => {
      const repository = make();
      const debt = await repository.create(loan({ principal: eur(10_000_000), termMonths: 120 }));
      await expect(repository.update(debt.id, { monthlyPayment: eur(100) })).rejects.toMatchObject({
        reason: 'invalid',
      });
      expect((await repository.getById(debt.id))?.monthlyPayment.amountMinor).toBe(
        debt.monthlyPayment.amountMinor,
      );
    });

    it('reports unknown ids', async () => {
      await expect(make().update('nope', { name: 'x' })).rejects.toMatchObject({
        reason: 'not-found',
      });
    });
  });

  describe('schedule', () => {
    it('is the full amortisation table, ending at zero', async () => {
      const repository = make();
      const debt = await repository.create(loan({ termMonths: 24, principal: eur(240_000) }));
      const schedule = await repository.schedule(debt.id);
      expect(schedule.rows).toHaveLength(24);
      expect(schedule.rows.at(-1)?.balance.amountMinor).toBe(0);
      expect(schedule.rows[0]?.date).toEqual(new Date(2025, 9, 15));
      const principalPaid = schedule.rows.reduce((sum, r) => sum + r.principal.amountMinor, 0);
      expect(principalPaid).toBe(240_000);
    });

    it('interest plus principal is every payment, and the interest total adds up', async () => {
      const repository = make();
      const debt = await repository.create(loan({ termMonths: 36 }));
      const schedule = await repository.schedule(debt.id);
      for (const row of schedule.rows) {
        expect(row.interest.amountMinor + row.principal.amountMinor).toBe(row.payment.amountMinor);
      }
      expect(schedule.rows.reduce((s, r) => s + r.interest.amountMinor, 0)).toBe(
        schedule.totalInterest.amountMinor,
      );
    });

    it('reports unknown ids', async () => {
      await expect(make().schedule('nope')).rejects.toMatchObject({ reason: 'not-found' });
    });
  });

  describe('payoffPlan', () => {
    it('orders the debts by the strategy and ends with a debt-free date', async () => {
      const repository = make();
      const big = await repository.create(loan({ name: 'Grande', annualRateBps: 400 }));
      const card = await repository.create(
        loan({ name: 'Tarjeta', principal: eur(200_000), annualRateBps: 2_100, termMonths: 24 }),
      );
      const avalanche = await repository.payoffPlan('h1', 'avalanche', eur(10_000));
      expect(avalanche.debts.find((d) => d.debtId === card.id)?.order).toBe(1);
      expect(avalanche.debts.find((d) => d.debtId === big.id)?.order).toBe(2);
      expect(avalanche.debtFreeDate.getTime()).toBeGreaterThan(NOW.getTime());
    });

    it('with nothing owed it is an empty plan dated today', async () => {
      const plan = await make().payoffPlan('h1', 'snowball', eur(0));
      expect(plan.debts).toEqual([]);
      expect(plan.totalInterest.amountMinor).toBe(0);
      expect(plan.debtFreeDate).toEqual(NOW);
    });
  });

  describe('demo data', () => {
    it('gives each household three debts, once', async () => {
      const repository = new InMemoryDebtRepository({ now: () => NOW });
      const list = await repository.list('h1');
      expect(list.map((d) => d.kind).sort()).toEqual(['car', 'credit-card', 'personal']);
      expect(await repository.list('h1')).toHaveLength(3);
      expect(list.every((d) => d.outstanding.amountMinor > 0 && d.endDate > NOW)).toBe(true);
    });
  });
});
