import { transactionDtoSchema } from '@icount/contracts';

import type { UserId } from '@/core/domain/Ids';
import { Money } from '@/core/domain/Money';
import { err, ok } from '@/core/domain/Result';
import type { HttpClient } from '@/core/network/httpClient';

import { TransactionError } from '../../../domain/TransactionError';
import { ApiTransactionRepository } from '../ApiTransactionRepository';
import {
  fromLocalDate,
  toCreateRequest,
  toLocalDate,
  toMonthlySummary,
} from '../transactionMapper';

const ana = '0199e0a4-5b2c-7c3d-9e4f-0000000000a1';
const dto = (id: string, occurredOn: string) =>
  transactionDtoSchema.parse({
    id,
    householdId: '0199e0a4-5b2c-7c3d-9e4f-0000000000c3',
    type: 'expense',
    amount: { amountMinor: 1_001, currency: 'EUR' },
    categoryId: 'bills',
    description: 'Luz',
    occurredOn,
    payerId: ana,
    shared: true,
    shares: [{ memberId: ana, amount: { amountMinor: 1_001, currency: 'EUR' } }],
    createdAt: '2026-10-06T09:00:00.000Z',
    updatedAt: '2026-10-06T09:00:00.000Z',
  });

const uuid = (n: number) => `0199e0a4-5b2c-7c3d-9e4f-${String(n).padStart(12, '0')}`;

function repositoryWith(responses: Awaited<ReturnType<HttpClient['request']>>[]) {
  const request = jest.fn(async () => responses.shift()!);
  return {
    request,
    repository: new ApiTransactionRepository({ request } as unknown as HttpClient),
  };
}

describe('transaction mapping', () => {
  it('keeps calendar days in local time both ways', () => {
    const date = fromLocalDate('2026-10-06');

    expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([
      2026, 9, 6, 0,
    ]);
    expect(toLocalDate(date)).toBe('2026-10-06');
    // 23:30 local is still the same calendar day, whatever the UTC offset.
    expect(toLocalDate(new Date(2026, 9, 6, 23, 30))).toBe('2026-10-06');
  });

  it('builds create requests from domain values', () => {
    expect(
      toCreateRequest({
        householdId: 'h',
        type: 'expense',
        amount: Money.ofMinor(1_250, 'EUR'),
        categoryId: 'food',
        description: 'Mercadona',
        occurredAt: new Date(2026, 9, 14),
        payerId: ana as UserId,
        shared: false,
      }),
    ).toEqual({
      type: 'expense',
      amount: { amountMinor: 1_250, currency: 'EUR' },
      categoryId: 'food',
      description: 'Mercadona',
      occurredOn: '2026-10-14',
      payerId: ana,
      shared: false,
    });
  });

  it('maps the monthly summary to Money and a category map', () => {
    const summary = toMonthlySummary({
      month: '2026-10',
      income: { amountMinor: 245_000, currency: 'EUR' },
      expenses: { amountMinor: 102_525, currency: 'EUR' },
      balance: { amountMinor: 142_475, currency: 'EUR' },
      expensesByCategory: [
        { categoryId: 'housing', amount: { amountMinor: 85_000, currency: 'EUR' } },
      ],
    });

    expect(summary.balance.equals(Money.ofMinor(142_475, 'EUR'))).toBe(true);
    expect(summary.expensesByCategory.get('housing')?.amountMinor).toBe(85_000);
  });
});

describe('ApiTransactionRepository', () => {
  it('walks every page to get a whole month', async () => {
    const { repository, request } = repositoryWith([
      ok({ items: [dto(uuid(1), '2026-10-06')], nextCursor: 'c1' }),
      ok({ items: [dto(uuid(2), '2026-10-01')], nextCursor: null }),
    ]);

    const month = await repository.findByMonth('h', { year: 2026, month: 10 });

    expect(month.map((t) => t.id)).toEqual([uuid(1), uuid(2)]);
    expect(request).toHaveBeenNthCalledWith(
      1,
      '/v1/households/h/transactions',
      expect.objectContaining({
        query: expect.objectContaining({ from: '2026-10-01', to: '2026-10-31', limit: 100 }),
      }),
    );
    expect(request).toHaveBeenNthCalledWith(
      2,
      '/v1/households/h/transactions',
      expect.objectContaining({ query: expect.objectContaining({ cursor: 'c1' }) }),
    );
  });

  it('returns null for a movement that does not exist (or is not visible)', async () => {
    const { repository } = repositoryWith([
      err({
        kind: 'http',
        status: 404,
        problem: { type: '/problems/transaction-not-found', status: 404 },
      }),
    ]);

    await expect(repository.getById(uuid(9))).resolves.toBeNull();
  });

  it.each([
    [{ kind: 'network', message: 'offline' } as const, 'network'],
    [
      {
        kind: 'http',
        status: 422,
        problem: { type: '/problems/unknown-category', status: 422 },
      } as const,
      'invalid',
    ],
    [
      {
        kind: 'http',
        status: 409,
        problem: { type: '/problems/transaction-id-conflict', status: 409 },
      } as const,
      'invalid',
    ],
    [
      { kind: 'http', status: 500, problem: { type: 'about:blank', status: 500 } } as const,
      'unknown',
    ],
  ])('maps %j to %s', async (error, reason) => {
    const { repository } = repositoryWith([err(error)]);

    await expect(repository.delete(uuid(1))).rejects.toEqual(expect.any(TransactionError));
    const again = repositoryWith([err(error)]);
    await expect(again.repository.delete(uuid(1))).rejects.toMatchObject({ reason });
  });
});
