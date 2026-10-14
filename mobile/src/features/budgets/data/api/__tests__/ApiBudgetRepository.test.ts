import { budgetDtoSchema } from '@icount/contracts';

import { Money } from '@/core/domain/Money';
import { err, ok } from '@/core/domain/Result';
import type { HttpClient } from '@/core/network/httpClient';

import { BudgetError } from '../../../domain/BudgetError';
import { ApiBudgetRepository } from '../ApiBudgetRepository';
import { toBudget, toCreateBudgetRequest } from '../budgetMapper';

const eur = (amountMinor: number) => ({ amountMinor, currency: 'EUR' });
const uuid = (n: number) => `0199e0a4-5b2c-7c3d-9e4f-${String(n).padStart(12, '0')}`;
const dto = (id: string, limitMinor: number, spentMinor: number) =>
  budgetDtoSchema.parse({
    id,
    householdId: uuid(100),
    categoryId: 'food',
    month: '2026-10',
    limit: eur(limitMinor),
    spent: eur(spentMinor),
    remaining: eur(limitMinor - spentMinor),
  });

function repositoryWith(responses: Awaited<ReturnType<HttpClient['request']>>[]) {
  const request = jest.fn(async () => responses.shift()!);
  return { request, repository: new ApiBudgetRepository({ request } as unknown as HttpClient) };
}

describe('budget mapping', () => {
  it('maps months and money both ways', () => {
    const budget = toBudget(dto(uuid(1), 40_000, 43_500));

    expect(budget.month).toEqual({ year: 2026, month: 10 });
    expect(budget.remaining.equals(Money.ofMinor(-3_500, 'EUR'))).toBe(true);
    expect(
      toCreateBudgetRequest({
        householdId: 'h',
        categoryId: 'food',
        month: { year: 2026, month: 3 },
        limit: Money.ofMinor(40_000, 'EUR'),
      }),
    ).toEqual({ categoryId: 'food', month: '2026-03', limit: eur(40_000) });
  });
});

describe('ApiBudgetRepository', () => {
  it('lists the budgets of a month', async () => {
    const { repository, request } = repositoryWith([ok([dto(uuid(1), 40_000, 0)])]);

    const budgets = await repository.list('h', { year: 2026, month: 10 });

    expect(budgets.map((b) => b.id)).toEqual([uuid(1)]);
    expect(request).toHaveBeenCalledWith(
      '/v1/households/h/budgets',
      expect.objectContaining({ query: { month: '2026-10' } }),
    );
  });

  it('moves an amount between two budgets', async () => {
    const { repository, request } = repositoryWith([
      ok([dto(uuid(1), 30_000, 0), dto(uuid(2), 20_000, 0)]),
    ]);

    const [from, to] = await repository.moveAmount(uuid(1), uuid(2), Money.ofMinor(10_000, 'EUR'));

    expect([from.limit.amountMinor, to.limit.amountMinor]).toEqual([30_000, 20_000]);
    expect(request).toHaveBeenCalledWith(
      '/v1/budgets/move',
      expect.objectContaining({
        method: 'POST',
        body: { fromBudgetId: uuid(1), toBudgetId: uuid(2), amount: eur(10_000) },
      }),
    );
  });

  it('updates the limit with PATCH', async () => {
    const { repository, request } = repositoryWith([ok(dto(uuid(1), 50_000, 0))]);

    await repository.updateLimit(uuid(1), Money.ofMinor(50_000, 'EUR'));

    expect(request).toHaveBeenCalledWith(
      `/v1/budgets/${uuid(1)}`,
      expect.objectContaining({ method: 'PATCH', body: { limit: eur(50_000) } }),
    );
  });

  it.each([
    ['duplicate-budget', 409, 'duplicate'],
    ['insufficient-amount', 422, 'insufficient-amount'],
    ['budget-not-found', 404, 'not-found'],
    ['invalid-budget-move', 422, 'invalid'],
  ])('maps the problem %s to %s', async (code, status, reason) => {
    const { repository } = repositoryWith([
      err({ kind: 'http', status, problem: { type: `/problems/${code}`, status } }),
    ]);

    await expect(repository.delete(uuid(1))).rejects.toMatchObject({ reason });
  });

  it('reports connectivity failures as network errors', async () => {
    const { repository } = repositoryWith([err({ kind: 'timeout', timeoutMs: 10_000 })]);

    await expect(repository.list('h', { year: 2026, month: 10 })).rejects.toEqual(
      new BudgetError('network'),
    );
  });
});
