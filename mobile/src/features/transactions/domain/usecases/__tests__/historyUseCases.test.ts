import { Money } from '@/core/domain/Money';

import { InMemoryTransactionRepository } from '../../../data/InMemoryTransactionRepository';
import type { CategoryId, Transaction } from '../../Transaction';
import {
  DeleteTransaction,
  GetDailyTotals,
  GetTransaction,
  ListTransactions,
  UpdateTransaction,
} from '../TransactionUseCases';

const NOW = new Date(2026, 9, 14, 12);
let n = 0;
function tx(partial: Partial<Transaction> = {}): Transaction {
  n += 1;
  return {
    id: `t${n}`,
    type: 'expense',
    amount: Money.ofMinor(1_000, 'EUR'),
    categoryId: 'food' as CategoryId,
    description: 'Café',
    occurredAt: new Date(2026, 9, 10),
    householdId: 'h1',
    payerId: 'u' as never,
    shared: false,
    shares: [],
    ...partial,
  };
}
const repo = (data: Transaction[]) =>
  new InMemoryTransactionRepository({ transactions: data, now: () => NOW });

describe('ListTransactions', () => {
  it('passes the filters and the page through', async () => {
    const repository = repo([
      tx({ description: 'Pan' }),
      tx({ description: 'Leche', type: 'income' }),
    ]);
    const page = await new ListTransactions(repository).execute(
      'h1',
      { type: 'income' },
      { limit: 5 },
    );
    expect(page.items.map((t) => t.description)).toEqual(['Leche']);
  });
});

describe('GetTransaction', () => {
  it('returns the movement', async () => {
    const t = tx();
    expect((await new GetTransaction(repo([t])).execute(t.id)).id).toBe(t.id);
  });

  it('turns "not there" into a not-found error, never null', async () => {
    await expect(new GetTransaction(repo([])).execute('nope')).rejects.toMatchObject({
      reason: 'not-found',
    });
  });
});

describe('GetDailyTotals', () => {
  it('asks the repository for the month', async () => {
    const repository = repo([tx({ occurredAt: new Date(2026, 9, 3) })]);
    const totals = await new GetDailyTotals(repository).execute('h1', { year: 2026, month: 10 });
    expect(totals).toHaveLength(1);
    expect(totals[0]?.expenses.amountMinor).toBe(1_000);
  });
});

describe('UpdateTransaction', () => {
  const make = (t: Transaction) => new UpdateTransaction(repo([t]), () => NOW);

  it('changes the given fields', async () => {
    const t = tx();
    const updated = await make(t).execute(t.id, {
      amount: Money.ofMinor(2_500, 'EUR'),
      description: '  Cena   fuera ',
    });
    expect(updated.amount.amountMinor).toBe(2_500);
    expect(updated.description).toBe('Cena fuera');
  });

  it('rejects an amount of zero or less', async () => {
    const t = tx();
    await expect(make(t).execute(t.id, { amount: Money.ofMinor(0, 'EUR') })).rejects.toMatchObject({
      reason: 'invalid',
    });
  });

  it('rejects a note over 80 characters and a future day', async () => {
    const t = tx();
    await expect(make(t).execute(t.id, { description: 'x'.repeat(81) })).rejects.toMatchObject({
      reason: 'invalid',
    });
    await expect(
      make(t).execute(t.id, { occurredAt: new Date(2026, 9, 15) }),
    ).rejects.toMatchObject({
      reason: 'invalid',
    });
  });

  it('accepts today and the past', async () => {
    const t = tx();
    await expect(
      make(t).execute(t.id, { occurredAt: new Date(2026, 9, 14, 23) }),
    ).resolves.toBeDefined();
    await expect(
      make(t).execute(t.id, { occurredAt: new Date(2020, 0, 1) }),
    ).resolves.toBeDefined();
  });

  it('reports an unknown movement', async () => {
    await expect(make(tx()).execute('nope', { description: 'x' })).rejects.toMatchObject({
      reason: 'not-found',
    });
  });
});

describe('DeleteTransaction', () => {
  it('removes it', async () => {
    const t = tx();
    const repository = repo([t]);
    await new DeleteTransaction(repository).execute(t.id);
    expect(await repository.getById(t.id)).toBeNull();
  });

  it('reports an unknown movement', async () => {
    await expect(new DeleteTransaction(repo([])).execute('nope')).rejects.toMatchObject({
      reason: 'not-found',
    });
  });
});
