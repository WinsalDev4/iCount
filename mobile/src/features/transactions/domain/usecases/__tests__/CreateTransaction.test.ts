import type { UserId } from '@/core/domain/Ids';
import { Money } from '@/core/domain/Money';

import { InMemoryTransactionRepository } from '../../../data/InMemoryTransactionRepository';
import type { CategoryId, NewTransaction } from '../../Transaction';
import {
  CreateTransaction,
  toOptimisticTransaction,
  type CreateTransactionCommand,
} from '../CreateTransaction';

const NOW = new Date(2026, 9, 14, 15, 30); // 14 Oct 2026, 15:30
const food = 'food' as CategoryId;

const command = (overrides: Partial<CreateTransactionCommand> = {}): CreateTransactionCommand => ({
  householdId: 'h1',
  type: 'expense',
  amount: Money.ofMinor(1_250, 'EUR'),
  categoryId: food,
  description: 'Menú',
  occurredAt: NOW,
  shared: false,
  ...overrides,
});

function make() {
  const repository = new InMemoryTransactionRepository({ seedDemoData: false });
  const useCase = new CreateTransaction(
    repository,
    () => 'fixed-id',
    () => NOW,
  );
  return { repository, useCase };
}

describe('CreateTransaction.prepare', () => {
  it('builds the input with a client-generated id and the day (not the time)', () => {
    const input = make().useCase.prepare(command());
    expect(input).toMatchObject({
      id: 'fixed-id',
      householdId: 'h1',
      type: 'expense',
      categoryId: food,
      description: 'Menú',
      shared: false,
    });
    expect(input.occurredAt).toEqual(new Date(2026, 9, 14));
  });

  it('cleans the description', () => {
    expect(
      make().useCase.prepare(command({ description: '  Café   con   leche ' })).description,
    ).toBe('Café con leche');
    expect(make().useCase.prepare(command({ description: undefined })).description).toBe('');
  });

  it.each([0, -100])('rejects an amount of %i cents', (cents) => {
    expect(() => make().useCase.prepare(command({ amount: Money.ofMinor(cents, 'EUR') }))).toThrow(
      expect.objectContaining({ reason: 'invalid' }),
    );
  });

  it('rejects a description over 80 characters', () => {
    expect(() => make().useCase.prepare(command({ description: 'a'.repeat(81) }))).toThrow(
      expect.objectContaining({ reason: 'invalid' }),
    );
    expect(
      make().useCase.prepare(command({ description: 'a'.repeat(80) })).description,
    ).toHaveLength(80);
  });

  it('rejects a date in the future but accepts today and the past', () => {
    expect(() => make().useCase.prepare(command({ occurredAt: new Date(2026, 9, 15) }))).toThrow(
      expect.objectContaining({ reason: 'invalid' }),
    );
    expect(() =>
      make().useCase.prepare(command({ occurredAt: new Date(2026, 9, 14, 23, 59) })),
    ).not.toThrow();
    expect(() =>
      make().useCase.prepare(command({ occurredAt: new Date(2020, 0, 1) })),
    ).not.toThrow();
  });

  it('rejects a missing category', () => {
    expect(() => make().useCase.prepare(command({ categoryId: '' as CategoryId }))).toThrow(
      expect.objectContaining({ reason: 'invalid' }),
    );
  });

  it('passes the payer and the shared flag through', () => {
    const payer = 'u2' as UserId;
    const input = make().useCase.prepare(command({ payerId: payer, shared: true }));
    expect(input).toMatchObject({ payerId: payer, shared: true });
  });
});

describe('CreateTransaction.execute', () => {
  it('stores the movement', async () => {
    const { repository, useCase } = make();
    const created = await useCase.execute(command());
    expect(created.id).toBe('fixed-id');
    expect((await repository.getById('fixed-id'))?.amount.amountMinor).toBe(1_250);
  });

  it('does not touch the repository when the data is invalid', async () => {
    const { repository, useCase } = make();
    const create = jest.spyOn(repository, 'create');
    await expect(useCase.execute(command({ amount: Money.ofMinor(0, 'EUR') }))).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
  });

  it('a retry with the same id does not duplicate the movement', async () => {
    const { repository, useCase } = make();
    const input = useCase.prepare(command());
    await useCase.send(input);
    await useCase.send(input);
    const page = await repository.list('h1', {}, {});
    expect(page.items).toHaveLength(1);
  });

  it('generates different ids by default', () => {
    const useCase = new CreateTransaction(
      new InMemoryTransactionRepository({ seedDemoData: false }),
    );
    const a = useCase.prepare(command({ occurredAt: new Date(2020, 0, 1) }));
    const b = useCase.prepare(command({ occurredAt: new Date(2020, 0, 1) }));
    expect(a.id).not.toBe(b.id);
  });
});

describe('toOptimisticTransaction', () => {
  const input: NewTransaction = {
    id: 'x1',
    householdId: 'h1',
    type: 'income',
    amount: Money.ofMinor(5_000, 'EUR'),
    categoryId: 'salary' as CategoryId,
    description: 'Extra',
    occurredAt: new Date(2026, 9, 14),
    shared: true,
  };

  it('looks like the movement the server will return, minus the computed shares', () => {
    const tx = toOptimisticTransaction(input, 'me' as UserId);
    expect(tx).toMatchObject({ id: 'x1', type: 'income', shared: true, shares: [] });
    expect(tx.payerId).toBe('me');
  });

  it('keeps an explicit payer', () => {
    expect(
      toOptimisticTransaction({ ...input, payerId: 'u9' as UserId }, 'me' as UserId).payerId,
    ).toBe('u9');
  });
});
