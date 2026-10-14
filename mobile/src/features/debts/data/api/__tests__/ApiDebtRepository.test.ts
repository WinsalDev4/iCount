import { debtDtoSchema, payoffStrategyResultDtoSchema } from '@icount/contracts';

import { Money } from '@/core/domain/Money';
import { err, ok } from '@/core/domain/Result';
import type { HttpClient } from '@/core/network/httpClient';

import { ApiDebtRepository } from '../ApiDebtRepository';
import { toCreateDebtRequest, toDebt, toUpdateDebtRequest } from '../debtMapper';

const eur = (amountMinor: number) => ({ amountMinor, currency: 'EUR' });
const uuid = (n: number) => `0199e0a4-5b2c-7c3d-9e4f-${String(n).padStart(12, '0')}`;
const dto = debtDtoSchema.parse({
  id: uuid(1),
  householdId: uuid(100),
  name: 'Coche',
  kind: 'car',
  principal: eur(1_500_000),
  outstanding: eur(1_200_000),
  annualRateBps: 690,
  aprBps: null,
  monthlyPayment: eur(35_850),
  startDate: '2026-01-05',
  termMonths: 48,
  endDate: '2029-12-05',
  createdAt: '2026-01-01T09:00:00.000Z',
});

const today = new Date(2026, 9, 14, 18, 30);

function repositoryWith(responses: Awaited<ReturnType<HttpClient['request']>>[]) {
  const request = jest.fn(async () => responses.shift()!);
  return {
    request,
    repository: new ApiDebtRepository({ request } as unknown as HttpClient, () => today),
  };
}

describe('debt mapping', () => {
  it('maps dates as local calendar days and amounts as Money', () => {
    const debt = toDebt(dto);

    expect(debt.endDate).toEqual(new Date(2029, 11, 5));
    expect(debt.outstanding.equals(Money.ofMinor(1_200_000, 'EUR'))).toBe(true);
  });

  it('only sends the instalment when the user sets one', () => {
    const input = {
      householdId: 'h',
      name: 'Coche',
      kind: 'car' as const,
      principal: Money.ofMinor(1_500_000, 'EUR'),
      annualRateBps: 690,
      startDate: new Date(2026, 0, 5),
      termMonths: 48,
    };

    expect(toCreateDebtRequest(input)).toEqual({
      name: 'Coche',
      kind: 'car',
      principal: eur(1_500_000),
      annualRateBps: 690,
      startDate: '2026-01-05',
      termMonths: 48,
    });
    expect(
      toCreateDebtRequest({ ...input, monthlyPayment: Money.ofMinor(40_000, 'EUR') }),
    ).toMatchObject({ monthlyPayment: eur(40_000) });
  });

  it('PATCH carries only the changes, and null clears the APR', () => {
    expect(
      toUpdateDebtRequest({ aprBps: null, monthlyPayment: Money.ofMinor(40_000, 'EUR') }),
    ).toEqual({ aprBps: null, monthlyPayment: eur(40_000) });
  });
});

describe('ApiDebtRepository', () => {
  it('asks for a payoff plan with the extra amount in cents', async () => {
    const { repository, request } = repositoryWith([
      ok(
        payoffStrategyResultDtoSchema.parse({
          strategy: 'avalanche',
          extraMonthly: eur(10_000),
          debts: [{ debtId: uuid(1), order: 1, payoffDate: '2028-03-05', interestPaid: eur(9) }],
          totalInterest: eur(9),
          debtFreeDate: '2028-03-05',
        }),
      ),
    ]);

    const plan = await repository.payoffPlan('h', 'avalanche', Money.ofMinor(10_000, 'EUR'));

    expect(plan.debtFreeDate).toEqual(new Date(2028, 2, 5));
    expect(request).toHaveBeenCalledWith(
      '/v1/households/h/debts/strategy',
      expect.objectContaining({ query: { strategy: 'avalanche', extraMonthlyMinor: 10_000 } }),
    );
  });

  it('with no debts left the household is debt free today', async () => {
    const { repository } = repositoryWith([
      ok({
        strategy: 'snowball',
        extraMonthly: eur(0),
        debts: [],
        totalInterest: eur(0),
        debtFreeDate: null,
      }),
    ]);

    const plan = await repository.payoffPlan('h', 'snowball', Money.ofMinor(0, 'EUR'));

    expect(plan.debtFreeDate).toEqual(new Date(2026, 9, 14));
  });

  it('returns null for a debt that does not exist', async () => {
    const { repository } = repositoryWith([
      err({
        kind: 'http',
        status: 404,
        problem: { type: '/problems/debt-not-found', status: 404 },
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
        problem: { type: '/problems/invalid-debt', status: 422 },
      } as const,
      'invalid',
    ],
    [{ kind: 'validation', message: 'bad body' } as const, 'unknown'],
  ])('maps %j to %s', async (error, reason) => {
    const { repository } = repositoryWith([err(error)]);

    await expect(repository.schedule(uuid(1))).rejects.toMatchObject({ reason });
  });
});
