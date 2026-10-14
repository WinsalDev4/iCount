import { recurringPaymentDtoSchema } from '@icount/contracts';

import type { UserId } from '@/core/domain/Ids';
import { Money } from '@/core/domain/Money';
import { err, ok } from '@/core/domain/Result';
import type { HttpClient } from '@/core/network/httpClient';

import { ApiRecurringPaymentRepository } from '../ApiRecurringPaymentRepository';
import {
  toCreateRecurringRequest,
  toRecurringPayment,
  toUpdateRecurringRequest,
} from '../recurringMapper';

const eur = (amountMinor: number) => ({ amountMinor, currency: 'EUR' });
const uuid = (n: number) => `0199e0a4-5b2c-7c3d-9e4f-${String(n).padStart(12, '0')}`;
const dto = recurringPaymentDtoSchema.parse({
  id: uuid(1),
  householdId: uuid(100),
  name: 'Luz',
  kind: 'bill',
  type: 'expense',
  amount: eur(6_890),
  categoryId: 'bills',
  rule: { unit: 'month', interval: 1, dayOfMonth: 31 },
  startDate: '2026-01-31',
  endDate: null,
  nextDueDate: '2026-10-31',
  payerId: uuid(10),
  shared: true,
  debtId: null,
  createdAt: '2026-01-01T09:00:00.000Z',
});

function repositoryWith(responses: Awaited<ReturnType<HttpClient['request']>>[]) {
  const request = jest.fn(async () => responses.shift()!);
  return {
    request,
    repository: new ApiRecurringPaymentRepository({ request } as unknown as HttpClient),
  };
}

describe('recurring payment mapping', () => {
  it('maps open-ended series and the next due date', () => {
    const payment = toRecurringPayment(dto);

    expect(payment.endDate).toBeNull();
    expect(payment.nextDueDate).toEqual(new Date(2026, 9, 31));
    expect(payment.amount.equals(Money.ofMinor(6_890, 'EUR'))).toBe(true);
  });

  it('builds create requests, linking loan instalments to their debt', () => {
    expect(
      toCreateRecurringRequest({
        householdId: 'h',
        name: 'Cuota coche',
        kind: 'loan',
        type: 'expense',
        amount: Money.ofMinor(35_850, 'EUR'),
        categoryId: 'loans',
        rule: { unit: 'month', interval: 1, dayOfMonth: 5 },
        startDate: new Date(2026, 0, 5),
        payerId: uuid(10) as UserId,
        shared: false,
        debtId: uuid(2),
      }),
    ).toEqual({
      name: 'Cuota coche',
      kind: 'loan',
      type: 'expense',
      amount: eur(35_850),
      categoryId: 'loans',
      rule: { unit: 'month', interval: 1, dayOfMonth: 5 },
      startDate: '2026-01-05',
      payerId: uuid(10),
      shared: false,
      debtId: uuid(2),
    });
  });

  it('PATCH sends only the changes; a null end date makes it open-ended', () => {
    expect(toUpdateRecurringRequest({ endDate: null })).toEqual({ endDate: null });
    expect(
      toUpdateRecurringRequest({ endDate: new Date(2027, 5, 30), amount: Money.ofMinor(1, 'EUR') }),
    ).toEqual({ endDate: '2027-06-30', amount: eur(1) });
  });
});

describe('ApiRecurringPaymentRepository', () => {
  it('asks for upcoming dues between two local days', async () => {
    const { repository, request } = repositoryWith([
      ok([
        {
          recurringPaymentId: uuid(1),
          name: 'Luz',
          dueDate: '2026-10-31',
          type: 'expense',
          amount: eur(6_890),
          categoryId: 'bills',
        },
      ]),
    ]);

    const dues = await repository.upcoming('h', new Date(2026, 9, 1), new Date(2026, 9, 31, 23));

    expect(dues[0]?.dueDate).toEqual(new Date(2026, 9, 31));
    expect(request).toHaveBeenCalledWith(
      '/v1/households/h/recurring/upcoming',
      expect.objectContaining({ query: { from: '2026-10-01', to: '2026-10-31' } }),
    );
  });

  it('lists the series of a household', async () => {
    const { repository } = repositoryWith([ok([dto])]);

    await expect(repository.list('h')).resolves.toHaveLength(1);
  });

  it.each([
    ['recurring-payment-not-found', 404, 'not-found'],
    ['invalid-recurring-payment', 422, 'invalid'],
    ['invalid-debt-payment', 422, 'invalid'],
  ])('maps the problem %s to %s', async (code, status, reason) => {
    const { repository } = repositoryWith([
      err({ kind: 'http', status, problem: { type: `/problems/${code}`, status } }),
    ]);

    await expect(repository.delete(uuid(1))).rejects.toMatchObject({ reason });
  });
});
