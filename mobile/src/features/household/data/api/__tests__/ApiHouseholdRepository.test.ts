import { householdDtoSchema } from '@icount/contracts';

import type { HouseholdId, UserId } from '@/core/domain/Ids';
import { Money } from '@/core/domain/Money';
import { err, ok } from '@/core/domain/Result';
import type { HttpClient } from '@/core/network/httpClient';

import { HouseholdError } from '../../../domain/HouseholdError';
import { ApiHouseholdRepository } from '../ApiHouseholdRepository';
import { fromSplitRule, toSplitRule } from '../householdMapper';

const ana = '0199e0a4-5b2c-7c3d-9e4f-0000000000a1';
const leo = '0199e0a4-5b2c-7c3d-9e4f-0000000000b2';
const householdId = '0199e0a4-5b2c-7c3d-9e4f-0000000000c3' as HouseholdId;

const dto = householdDtoSchema.parse({
  id: householdId,
  name: 'Piso',
  kind: 'shared',
  currency: 'EUR',
  splitRule: {
    type: 'custom',
    categories: [
      {
        categoryId: 'housing',
        shares: [
          { memberId: ana, basisPoints: 6_000 },
          { memberId: leo, basisPoints: 4_000 },
        ],
      },
    ],
  },
  members: [
    {
      userId: ana,
      email: 'ana@icount.app',
      displayName: 'Ana',
      role: 'admin',
      monthlyIncome: { amountMinor: 245_000, currency: 'EUR' },
      joinedAt: '2026-10-14T08:00:00.000Z',
    },
    {
      userId: leo,
      email: 'leo@icount.app',
      displayName: null,
      role: 'member',
      monthlyIncome: null,
      joinedAt: '2026-10-14T09:00:00.000Z',
    },
  ],
  createdAt: '2026-10-14T08:00:00.000Z',
});

function repositoryAnswering(result: Awaited<ReturnType<HttpClient['request']>>) {
  const request = jest.fn(async () => result);
  return { request, repository: new ApiHouseholdRepository({ request } as unknown as HttpClient) };
}

describe('ApiHouseholdRepository', () => {
  it('maps households to the domain (kind, Money, branded ids)', async () => {
    const { repository } = repositoryAnswering(ok([dto]));

    const [household] = await repository.getMine();

    expect(household).toMatchObject({ id: householdId, name: 'Piso', kind: 'shared' });
    expect(household!.splitRule).toMatchObject({ kind: 'custom' });
    expect(household!.members[0]!.monthlyIncome?.equals(Money.ofMinor(245_000, 'EUR'))).toBe(true);
    expect(household!.members[1]!.monthlyIncome).toBeNull();
  });

  it('sends incomes and split rules in the contract shape', async () => {
    const { repository, request } = repositoryAnswering(ok(dto));

    await repository.setMyIncome(householdId, Money.ofMinor(180_000, 'EUR'));
    await repository.setSplitRule(householdId, { kind: 'income-proportional' });

    expect(request).toHaveBeenNthCalledWith(
      1,
      `/v1/households/${householdId}/members/me/income`,
      expect.objectContaining({
        method: 'PUT',
        body: { monthlyIncome: { amountMinor: 180_000, currency: 'EUR' } },
      }),
    );
    expect(request).toHaveBeenNthCalledWith(
      2,
      `/v1/households/${householdId}/split-rule`,
      expect.objectContaining({ body: { splitRule: { type: 'income-proportional' } } }),
    );
  });

  it.each([
    ['/problems/invalid-invite', 404, 'invalid-invite'],
    ['/problems/expired-invite', 422, 'expired-invite'],
    ['/problems/already-member', 409, 'already-member'],
    ['/problems/household-not-found', 404, 'not-found'],
    ['/problems/not-household-admin', 403, 'forbidden'],
    ['about:blank', 500, 'unknown'],
  ])('maps %s to the %s reason', async (type, status, reason) => {
    const { repository } = repositoryAnswering(
      err({ kind: 'http', status, problem: { type, status } }),
    );

    await expect(repository.join('ABCD2345')).rejects.toMatchObject({ reason });
  });

  it('reports connectivity problems as network errors', async () => {
    const { repository } = repositoryAnswering(err({ kind: 'network', message: 'offline' }));

    await expect(repository.getMine()).rejects.toEqual(new HouseholdError('network'));
  });
});

describe('split rule mapping', () => {
  it('round-trips between the contract and the domain', () => {
    const domain = toSplitRule(dto.splitRule);

    expect(domain).toEqual({
      kind: 'custom',
      categories: [
        {
          categoryId: 'housing',
          shares: [
            { memberId: ana as UserId, basisPoints: 6_000 },
            { memberId: leo as UserId, basisPoints: 4_000 },
          ],
        },
      ],
    });
    expect(fromSplitRule(domain)).toEqual(dto.splitRule);
  });
});
