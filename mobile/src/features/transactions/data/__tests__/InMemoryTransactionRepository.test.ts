import type { UserId } from '@/core/domain/Ids';
import { Money } from '@/core/domain/Money';

import type { CategoryId, NewTransaction, Transaction } from '../../domain/Transaction';
import { InMemoryTransactionRepository } from '../InMemoryTransactionRepository';

const me = 'u-me' as UserId;
const ana = 'u-ana' as UserId;
const NOW = new Date(2026, 9, 14, 12);
const eur = (cents: number) => Money.ofMinor(cents, 'EUR');

function tx(partial: Partial<Transaction> & { id: string }): Transaction {
  return {
    type: 'expense',
    amount: eur(1_000),
    categoryId: 'food' as CategoryId,
    description: '',
    occurredAt: new Date(2026, 9, 10),
    householdId: 'h1',
    payerId: me,
    shared: false,
    shares: [],
    ...partial,
  };
}

const make = (transactions: Transaction[] = []) =>
  new InMemoryTransactionRepository({ transactions, now: () => NOW, me: () => me });

describe('demo data', () => {
  it('fills any household lazily and never with future dates', async () => {
    const repository = new InMemoryTransactionRepository({ now: () => NOW, me: () => me });
    const page = await repository.list('brand-new', {}, { limit: 100 });
    expect(page.items.length).toBeGreaterThan(8);
    expect(page.items.every((t) => t.occurredAt <= NOW)).toBe(true);
    expect(page.items.every((t) => t.householdId === 'brand-new' && t.payerId === me)).toBe(true);
  });

  it('seeds a household only once', async () => {
    const repository = new InMemoryTransactionRepository({ now: () => NOW, me: () => me });
    const first = await repository.list('h', {}, { limit: 100 });
    const second = await repository.list('h', {}, { limit: 100 });
    expect(second.items).toHaveLength(first.items.length);
  });

  it('gives different households different movements', async () => {
    const repository = new InMemoryTransactionRepository({ now: () => NOW, me: () => me });
    const a = await repository.list('a', {}, { limit: 100 });
    const b = await repository.list('b', {}, { limit: 100 });
    expect(a.items.map((t) => t.id)).not.toEqual(b.items.map((t) => t.id));
  });

  it('is off when the data is given explicitly', async () => {
    expect((await make().list('h1', {}, {})).items).toEqual([]);
  });
});

describe('list', () => {
  const data = [
    tx({ id: 'a', occurredAt: new Date(2026, 9, 1), description: 'Café' }),
    tx({
      id: 'b',
      occurredAt: new Date(2026, 9, 5),
      type: 'income',
      categoryId: 'salary' as CategoryId,
    }),
    tx({
      id: 'c',
      occurredAt: new Date(2026, 9, 5),
      description: 'Cena',
      shared: true,
      payerId: ana,
    }),
    tx({ id: 'd', occurredAt: new Date(2026, 8, 20), categoryId: 'leisure' as CategoryId }),
    tx({ id: 'e', householdId: 'other' }),
  ];

  it('lists a household newest first, ties broken by id', async () => {
    const page = await make(data).list('h1', {}, {});
    expect(page.items.map((t) => t.id)).toEqual(['c', 'b', 'a', 'd']);
  });

  it('filters by type, category, shared and payer', async () => {
    const repository = make(data);
    const ids = async (filters: Parameters<typeof repository.list>[1]) =>
      (await repository.list('h1', filters, {})).items.map((t) => t.id);
    expect(await ids({ type: 'income' })).toEqual(['b']);
    expect(await ids({ categoryId: 'leisure' as CategoryId })).toEqual(['d']);
    expect(await ids({ shared: true })).toEqual(['c']);
    expect(await ids({ memberId: ana })).toEqual(['c']);
  });

  it('matches a member who only appears in the shares', async () => {
    const withShares = tx({
      id: 's',
      shared: true,
      shares: [{ memberId: ana, amount: eur(500) }],
    });
    const page = await make([withShares]).list('h1', { memberId: ana }, {});
    expect(page.items.map((t) => t.id)).toEqual(['s']);
  });

  it('filters by an inclusive day range', async () => {
    const page = await make(data).list(
      'h1',
      { from: new Date(2026, 9, 1), to: new Date(2026, 9, 5) },
      {},
    );
    expect(page.items.map((t) => t.id)).toEqual(['c', 'b', 'a']);
  });

  it('searches the description ignoring case and accents', async () => {
    const repository = make(data);
    expect((await repository.list('h1', { query: 'cafe' }, {})).items.map((t) => t.id)).toEqual([
      'a',
    ]);
    expect((await repository.list('h1', { query: '  CENA ' }, {})).items.map((t) => t.id)).toEqual([
      'c',
    ]);
    expect((await repository.list('h1', { query: 'zzz' }, {})).items).toEqual([]);
  });

  it('pages with an opaque cursor until the end', async () => {
    const repository = make(data);
    const first = await repository.list('h1', {}, { limit: 3 });
    expect(first.items.map((t) => t.id)).toEqual(['c', 'b', 'a']);
    expect(first.nextCursor).not.toBeNull();

    const second = await repository.list(
      'h1',
      {},
      { limit: 3, cursor: first.nextCursor ?? undefined },
    );
    expect(second.items.map((t) => t.id)).toEqual(['d']);
    expect(second.nextCursor).toBeNull();
  });

  it('survives a garbage cursor and an absurd limit', async () => {
    const repository = make(data);
    expect((await repository.list('h1', {}, { cursor: 'nope', limit: 1 })).items).toHaveLength(1);
    expect((await repository.list('h1', {}, { limit: 100_000 })).items).toHaveLength(4);
    expect((await repository.list('h1', {}, { limit: 0 })).items).toHaveLength(1);
  });
});

describe('create / get / update / delete', () => {
  const input: NewTransaction = {
    id: 'new-1',
    householdId: 'h1',
    type: 'expense',
    amount: eur(2_500),
    categoryId: 'food' as CategoryId,
    description: 'Compra',
    occurredAt: new Date(2026, 9, 14, 18, 45),
    shared: false,
  };

  it('creates with the signed-in member as default payer and the day at midnight', async () => {
    const repository = make();
    const created = await repository.create(input);
    expect(created.payerId).toBe(me);
    expect(created.occurredAt).toEqual(new Date(2026, 9, 14));
    expect(await repository.getById('new-1')).toEqual(created);
  });

  it('puts the new movement on top of the list', async () => {
    const repository = make([tx({ id: 'old', occurredAt: new Date(2026, 9, 13) })]);
    await repository.create(input);
    const page = await repository.list('h1', {}, {});
    expect(page.items[0]?.id).toBe('new-1');
  });

  it('refuses a non-positive amount', async () => {
    await expect(make().create({ ...input, amount: eur(0) })).rejects.toMatchObject({
      reason: 'invalid',
    });
  });

  it('is idempotent for the same client id', async () => {
    const repository = make();
    await repository.create(input);
    await repository.create(input);
    expect((await repository.list('h1', {}, {})).items).toHaveLength(1);
  });

  it('generates ids when the client does not', async () => {
    const repository = make();
    const a = await repository.create({ ...input, id: undefined });
    const b = await repository.create({ ...input, id: undefined });
    expect(a.id).not.toBe(b.id);
  });

  it('getById returns null for an unknown id', async () => {
    expect(await make().getById('nope')).toBeNull();
  });

  it('updates only the given fields', async () => {
    const repository = make([tx({ id: 'u', description: 'Antes', amount: eur(1_000) })]);
    const updated = await repository.update('u', { description: 'Después', amount: undefined });
    expect(updated.description).toBe('Después');
    expect(updated.amount.amountMinor).toBe(1_000);
    expect((await repository.getById('u'))?.description).toBe('Después');
  });

  it('update moves the day to midnight and validates the amount', async () => {
    const repository = make([tx({ id: 'u' })]);
    const moved = await repository.update('u', { occurredAt: new Date(2026, 9, 3, 22) });
    expect(moved.occurredAt).toEqual(new Date(2026, 9, 3));
    await expect(repository.update('u', { amount: eur(-5) })).rejects.toMatchObject({
      reason: 'invalid',
    });
  });

  it('update and delete report unknown ids', async () => {
    const repository = make();
    await expect(repository.update('nope', {})).rejects.toMatchObject({ reason: 'not-found' });
    await expect(repository.delete('nope')).rejects.toMatchObject({ reason: 'not-found' });
  });

  it('deletes', async () => {
    const repository = make([tx({ id: 'gone' })]);
    await repository.delete('gone');
    expect(await repository.getById('gone')).toBeNull();
  });
});

describe('summaries', () => {
  const data = [
    tx({
      id: '1',
      type: 'income',
      amount: eur(200_000),
      categoryId: 'salary' as CategoryId,
      occurredAt: new Date(2026, 9, 1),
    }),
    tx({ id: '2', amount: eur(5_000), occurredAt: new Date(2026, 9, 1) }),
    tx({
      id: '3',
      amount: eur(2_500),
      categoryId: 'leisure' as CategoryId,
      occurredAt: new Date(2026, 9, 2),
    }),
    tx({ id: '4', amount: eur(9_999), occurredAt: new Date(2026, 8, 30) }),
  ];

  it('monthlySummary adds up the month and ignores other months', async () => {
    const summary = await make(data).monthlySummary('h1', { year: 2026, month: 10 });
    expect(summary.income.amountMinor).toBe(200_000);
    expect(summary.expenses.amountMinor).toBe(7_500);
    expect(summary.balance.amountMinor).toBe(192_500);
    expect(summary.expensesByCategory.get('food' as CategoryId)?.amountMinor).toBe(5_000);
  });

  it('dailyTotals has one entry per day with movements, oldest first', async () => {
    const days = await make(data).dailyTotals('h1', { year: 2026, month: 10 });
    expect(days.map((d) => d.date.getDate())).toEqual([1, 2]);
    expect(days[0]?.income.amountMinor).toBe(200_000);
    expect(days[0]?.expenses.amountMinor).toBe(5_000);
    expect(days[1]?.expenses.amountMinor).toBe(2_500);
  });

  it('an empty month has zero totals and no days', async () => {
    const repository = make(data);
    const summary = await repository.monthlySummary('h1', { year: 2020, month: 1 });
    expect(summary.balance.amountMinor).toBe(0);
    expect(await repository.dailyTotals('h1', { year: 2020, month: 1 })).toEqual([]);
  });
});
