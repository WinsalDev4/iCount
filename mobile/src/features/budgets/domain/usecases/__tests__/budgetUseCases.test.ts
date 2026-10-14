import type { CategoryId } from '@/core/domain/Category';
import { Money } from '@/core/domain/Money';
import { InMemoryTransactionRepository } from '@/features/transactions/data/InMemoryTransactionRepository';

import { InMemoryBudgetRepository } from '../../../data/InMemoryBudgetRepository';
import {
  CreateBudget,
  DeleteBudget,
  ListBudgets,
  MoveBudgetAmount,
  UpdateBudgetLimit,
} from '../BudgetUseCases';

const eur = (cents: number) => Money.ofMinor(cents, 'EUR');
const OCT = { year: 2026, month: 10 };
const food = 'food' as CategoryId;

const repo = () =>
  new InMemoryBudgetRepository(new InMemoryTransactionRepository({ transactions: [] }), {
    seedDemoData: false,
  });

describe('budget use cases', () => {
  it('create + list', async () => {
    const repository = repo();
    await new CreateBudget(repository).execute({
      householdId: 'h',
      categoryId: food,
      month: OCT,
      limit: eur(100),
    });
    expect(await new ListBudgets(repository).execute('h', OCT)).toHaveLength(1);
  });

  it('create refuses a non-positive limit without calling the repository', async () => {
    const repository = repo();
    const create = jest.spyOn(repository, 'create');
    await expect(
      new CreateBudget(repository).execute({
        householdId: 'h',
        categoryId: food,
        month: OCT,
        limit: eur(0),
      }),
    ).rejects.toMatchObject({ reason: 'invalid' });
    expect(create).not.toHaveBeenCalled();
  });

  it('update refuses a non-positive limit without calling the repository', async () => {
    const repository = repo();
    const update = jest.spyOn(repository, 'updateLimit');
    await expect(new UpdateBudgetLimit(repository).execute('x', eur(-1))).rejects.toMatchObject({
      reason: 'invalid',
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('update and delete go through', async () => {
    const repository = repo();
    const created = await repository.create({
      householdId: 'h',
      categoryId: food,
      month: OCT,
      limit: eur(100),
    });
    expect(
      (await new UpdateBudgetLimit(repository).execute(created.id, eur(300))).limit.amountMinor,
    ).toBe(300);
    await new DeleteBudget(repository).execute(created.id);
    expect(await repository.list('h', OCT)).toEqual([]);
  });

  it('move refuses the same budget on both sides and a zero amount, before the repository', async () => {
    const repository = repo();
    const move = jest.spyOn(repository, 'moveAmount');
    const useCase = new MoveBudgetAmount(repository);
    await expect(useCase.execute('a', 'a', eur(10))).rejects.toMatchObject({ reason: 'invalid' });
    await expect(useCase.execute('a', 'b', eur(0))).rejects.toMatchObject({ reason: 'invalid' });
    expect(move).not.toHaveBeenCalled();
  });

  it('move works for two budgets of the month', async () => {
    const repository = repo();
    const a = await repository.create({
      householdId: 'h',
      categoryId: food,
      month: OCT,
      limit: eur(1_000),
    });
    const b = await repository.create({
      householdId: 'h',
      categoryId: 'leisure' as CategoryId,
      month: OCT,
      limit: eur(1_000),
    });
    const [from, to] = await new MoveBudgetAmount(repository).execute(a.id, b.id, eur(250));
    expect([from.limit.amountMinor, to.limit.amountMinor]).toEqual([750, 1_250]);
  });
});
