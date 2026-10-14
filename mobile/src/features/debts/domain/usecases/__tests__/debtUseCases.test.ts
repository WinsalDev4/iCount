import { Money } from '@/core/domain/Money';

import { InMemoryDebtRepository } from '../../../data/InMemoryDebtRepository';
import type { Debt, NewDebt } from '../../Debt';
import { ComparePayoffStrategies } from '../ComparePayoffStrategies';
import { CreateDebt, DeleteDebt, GetDebt, ListDebts, UpdateDebt } from '../DebtUseCases';
import { SimulateExtraPayment } from '../SimulateExtraPayment';

const eur = (cents: number) => Money.ofMinor(cents, 'EUR');
const TODAY = new Date(2026, 9, 14);

const input = (extra: Partial<NewDebt> = {}): NewDebt => ({
  householdId: 'h',
  name: 'Coche',
  kind: 'car',
  principal: eur(1_200_000),
  annualRateBps: 690,
  startDate: new Date(2025, 9, 15),
  termMonths: 60,
  ...extra,
});
const repo = () => new InMemoryDebtRepository({ debts: [], now: () => TODAY });

describe('validations', () => {
  it.each([
    ['empty name', { name: '   ' }],
    ['long name', { name: 'x'.repeat(61) }],
    ['zero principal', { principal: eur(0) }],
    ['zero term', { termMonths: 0 }],
    ['fractional term', { termMonths: 12.5 }],
    ['term over 50 years', { termMonths: 601 }],
    ['negative rate', { annualRateBps: -1 }],
    ['rate over 100 %', { annualRateBps: 10_001 }],
    ['fractional rate', { annualRateBps: 6.9 }],
    ['zero instalment', { monthlyPayment: eur(0) }],
  ])('CreateDebt refuses %s without touching the repository', async (_label, bad) => {
    const repository = repo();
    const create = jest.spyOn(repository, 'create');
    await expect(new CreateDebt(repository).execute(input(bad))).rejects.toMatchObject({
      reason: 'invalid',
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('CreateDebt cleans the name', async () => {
    const debt = await new CreateDebt(repo()).execute(input({ name: '  Préstamo   del coche ' }));
    expect(debt.name).toBe('Préstamo del coche');
  });

  it('UpdateDebt validates only what changes', async () => {
    const repository = repo();
    const debt = await repository.create(input());
    const update = new UpdateDebt(repository);
    await expect(update.execute(debt.id, { name: '' })).rejects.toMatchObject({
      reason: 'invalid',
    });
    await expect(update.execute(debt.id, { termMonths: 0 })).rejects.toMatchObject({
      reason: 'invalid',
    });
    await expect(update.execute(debt.id, { annualRateBps: 20_000 })).rejects.toMatchObject({
      reason: 'invalid',
    });
    await expect(update.execute(debt.id, { monthlyPayment: eur(-1) })).rejects.toMatchObject({
      reason: 'invalid',
    });
    expect((await update.execute(debt.id, { name: '  Nuevo  nombre ' })).name).toBe('Nuevo nombre');
  });

  it('GetDebt returns it or says not found (never null)', async () => {
    const repository = repo();
    const debt = await repository.create(input());
    expect((await new GetDebt(repository).execute(debt.id)).id).toBe(debt.id);
    await expect(new GetDebt(repository).execute('nope')).rejects.toMatchObject({
      reason: 'not-found',
    });
  });

  it('DeleteDebt removes it', async () => {
    const repository = repo();
    const debt = await repository.create(input());
    await new DeleteDebt(repository).execute(debt.id);
    expect(await repository.list('h')).toEqual([]);
  });
});

describe('ListDebts', () => {
  it('biggest balance first, paid-off debts last', async () => {
    const repository = repo();
    await repository.create(
      input({
        name: 'Pequeña',
        principal: eur(100_000),
        termMonths: 36,
        startDate: new Date(2026, 8, 1),
      }),
    );
    await repository.create(
      input({ name: 'Pagada', startDate: new Date(2018, 0, 1), termMonths: 12 }),
    );
    await repository.create(
      input({
        name: 'Grande',
        principal: eur(5_000_000),
        termMonths: 120,
        startDate: new Date(2026, 8, 1),
      }),
    );
    const names = (await new ListDebts(repository).execute('h')).map((d) => d.name);
    expect(names).toEqual(['Grande', 'Pequeña', 'Pagada']);
  });
});

describe('SimulateExtraPayment', () => {
  const simulate = new SimulateExtraPayment();
  async function oneDebt(extra: Partial<NewDebt> = {}): Promise<Debt> {
    return repo().create(input(extra));
  }

  it('paying extra shortens the debt and saves interest', async () => {
    const debt = await oneDebt();
    const result = simulate.execute(debt, eur(10_000), TODAY);
    expect(result).not.toBeNull();
    expect(result?.monthsSaved).toBeGreaterThan(0);
    expect(result?.withExtraMonths).toBe(
      (result?.baselineMonths ?? 0) - (result?.monthsSaved ?? 0),
    );
    expect(result?.interestSaved.amountMinor).toBeGreaterThan(0);
    expect(result?.interestSaved.amountMinor).toBe(
      (result?.baselineInterest.amountMinor ?? 0) - (result?.withExtraInterest.amountMinor ?? 0),
    );
    expect(result?.newPayoffDate?.getTime() ?? 0).toBeLessThan(
      result?.baselinePayoffDate?.getTime() ?? 0,
    );
  });

  it('more extra saves more, with diminishing but positive returns', async () => {
    const debt = await oneDebt();
    const saved = [5_000, 10_000, 20_000].map(
      (cents) => simulate.execute(debt, eur(cents), TODAY)?.interestSaved.amountMinor ?? 0,
    );
    expect(saved[0]).toBeGreaterThan(0);
    expect(saved[1]).toBeGreaterThan(saved[0] as number);
    expect(saved[2]).toBeGreaterThan(saved[1] as number);
  });

  it('extra of zero changes nothing', async () => {
    const result = simulate.execute(await oneDebt(), eur(0), TODAY);
    expect(result?.monthsSaved).toBe(0);
    expect(result?.interestSaved.amountMinor).toBe(0);
  });

  it('starts from what is owed today: the baseline matches the remaining instalments', async () => {
    const debt = await oneDebt();
    const result = simulate.execute(debt, eur(0), TODAY);
    // First instalment was 14 Oct 2025... 12 months in: 48 left (the 15th of this month counts).
    expect(result?.baselineMonths).toBe(48);
    expect(result?.baselinePayoffDate).toEqual(debt.endDate);
  });

  it('returns null for a paid-off debt', async () => {
    const paid = await oneDebt({ startDate: new Date(2018, 0, 1), termMonths: 12 });
    expect(simulate.execute(paid, eur(5_000), TODAY)).toBeNull();
  });

  it('refuses a negative extra', async () => {
    expect(() => simulate.execute({} as Debt, eur(-1), TODAY)).toThrow(
      expect.objectContaining({ reason: 'invalid' }),
    );
  });

  it('an instalment that does not cover the interest is "invalid", not a crash', async () => {
    const debt = { ...(await oneDebt()), monthlyPayment: eur(100) } as Debt;
    expect(() => simulate.execute(debt, eur(0), TODAY)).toThrow(
      expect.objectContaining({ reason: 'invalid' }),
    );
  });
});

describe('ComparePayoffStrategies', () => {
  const compare = new ComparePayoffStrategies();
  async function household() {
    const repository = repo();
    const car = await repository.create(input({ name: 'Coche', annualRateBps: 690 }));
    const card = await repository.create(
      input({
        name: 'Tarjeta',
        principal: eur(300_000),
        annualRateBps: 2_100,
        termMonths: 24,
        startDate: new Date(2026, 5, 1),
      }),
    );
    const personal = await repository.create(
      input({
        name: 'Personal',
        principal: eur(150_000),
        annualRateBps: 590,
        termMonths: 36,
        startDate: new Date(2026, 6, 1),
      }),
    );
    return { debts: await repository.list('h'), car, card, personal };
  }

  it('is null with nothing owed', () => {
    expect(compare.execute([], eur(0), TODAY)).toBeNull();
  });

  it('avalanche goes for the highest rate, snowball for the smallest balance', async () => {
    const { debts, card, personal } = await household();
    const result = compare.execute(debts, eur(10_000), TODAY);
    expect(result?.avalanche.debts.find((d) => d.order === 1)?.debtId).toBe(card.id);
    expect(result?.snowball.debts.find((d) => d.order === 1)?.debtId).toBe(personal.id);
    expect(result?.snowballFirstWin).toBe(personal.id);
  });

  it('avalanche never pays more interest than snowball, and says how much it saves', async () => {
    const { debts } = await household();
    const result = compare.execute(debts, eur(10_000), TODAY);
    expect(result?.avalanche.totalInterest.amountMinor).toBeLessThanOrEqual(
      result?.snowball.totalInterest.amountMinor ?? 0,
    );
    expect(result?.avalancheSavesInterest.amountMinor).toBe(
      (result?.snowball.totalInterest.amountMinor ?? 0) -
        (result?.avalanche.totalInterest.amountMinor ?? 0),
    );
    expect(result?.avalancheSavesMonths).toBeGreaterThanOrEqual(0);
  });

  it('both strategies pay everything off', async () => {
    const { debts } = await household();
    const result = compare.execute(debts, eur(0), TODAY);
    expect(result?.avalanche.debts).toHaveLength(3);
    expect(result?.snowball.debts).toHaveLength(3);
    expect(result?.avalanche.debtFreeDate.getTime()).toBeGreaterThan(TODAY.getTime());
  });

  it('more monthly extra brings the debt-free date forward', async () => {
    const { debts } = await household();
    const slow = compare.execute(debts, eur(0), TODAY);
    const fast = compare.execute(debts, eur(50_000), TODAY);
    expect(fast?.avalanche.debtFreeDate.getTime()).toBeLessThan(
      slow?.avalanche.debtFreeDate.getTime() ?? 0,
    );
    expect(fast?.avalanche.totalInterest.amountMinor).toBeLessThan(
      slow?.avalanche.totalInterest.amountMinor ?? 0,
    );
  });

  it('with one single debt both strategies are the same plan', async () => {
    const repository = repo();
    await repository.create(input());
    const result = compare.execute(await repository.list('h'), eur(5_000), TODAY);
    expect(result?.avalanche.totalInterest.amountMinor).toBe(
      result?.snowball.totalInterest.amountMinor,
    );
    expect(result?.avalancheSavesInterest.amountMinor).toBe(0);
  });

  it('ignores paid-off debts', async () => {
    const repository = repo();
    await repository.create(input({ startDate: new Date(2018, 0, 1), termMonths: 12 }));
    expect(compare.execute(await repository.list('h'), eur(0), TODAY)).toBeNull();
  });

  it('refuses a negative extra', async () => {
    const { debts } = await household();
    expect(() => compare.execute(debts, eur(-1), TODAY)).toThrow(
      expect.objectContaining({ reason: 'invalid' }),
    );
  });
});
