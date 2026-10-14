import { householdBalanceDtoSchema } from '@icount/contracts';

import type { UserId } from '@/core/domain/Ids';
import { Money } from '@/core/domain/Money';
import { err, ok } from '@/core/domain/Result';
import type { HttpClient } from '@/core/network/httpClient';

import { ApiSettlementRepository } from '../ApiSettlementRepository';
import { toCreateSettlementRequest, toHouseholdBalance } from '../settlementMapper';

const eur = (amountMinor: number) => ({ amountMinor, currency: 'EUR' });
const uuid = (n: number) => `0199e0a4-5b2c-7c3d-9e4f-${String(n).padStart(12, '0')}`;
const [ana, leo, eva] = [uuid(1), uuid(2), uuid(3)];

function repositoryWith(responses: Awaited<ReturnType<HttpClient['request']>>[]) {
  const request = jest.fn(async () => responses.shift()!);
  return {
    request,
    repository: new ApiSettlementRepository({ request } as unknown as HttpClient),
  };
}

describe('settlement mapping', () => {
  it('maps a three-member balance with odd cents and its transfers', () => {
    const balance = toHouseholdBalance(
      householdBalanceDtoSchema.parse({
        householdId: uuid(100),
        members: [
          { memberId: ana, paid: eur(10_001), owed: eur(3_335), net: eur(6_666) },
          { memberId: leo, paid: eur(0), owed: eur(3_333), net: eur(-3_333) },
          { memberId: eva, paid: eur(0), owed: eur(3_333), net: eur(-3_333) },
        ],
        suggestedTransfers: [
          { fromMemberId: leo, toMemberId: ana, amount: eur(3_333) },
          { fromMemberId: eva, toMemberId: ana, amount: eur(3_333) },
        ],
        pendingApprovalCount: 2,
      }),
    );

    expect(balance.members.reduce((sum, m) => sum + m.net.amountMinor, 0)).toBe(0);
    expect(balance.suggestedTransfers[0]).toEqual({
      from: leo,
      to: ana,
      amount: Money.ofMinor(3_333, 'EUR'),
    });
    expect(balance.pendingApprovalCount).toBe(2);
  });

  it('builds the request with the local day it was paid', () => {
    expect(
      toCreateSettlementRequest({
        householdId: 'h',
        from: leo as UserId,
        to: ana as UserId,
        amount: Money.ofMinor(3_333, 'EUR'),
        method: 'bizum',
        note: 'Octubre',
        settledOn: new Date(2026, 9, 12, 23, 59),
      }),
    ).toEqual({
      fromMemberId: leo,
      toMemberId: ana,
      amount: eur(3_333),
      method: 'bizum',
      note: 'Octubre',
      settledOn: '2026-10-12',
    });
  });
});

describe('ApiSettlementRepository', () => {
  it('asks for the balance of a period', async () => {
    const { repository, request } = repositoryWith([
      ok({ householdId: uuid(100), members: [], suggestedTransfers: [], pendingApprovalCount: 0 }),
    ]);

    await repository.balance('h', { from: new Date(2026, 9, 1), to: new Date(2026, 9, 31) });

    expect(request).toHaveBeenCalledWith(
      '/v1/households/h/balance',
      expect.objectContaining({ query: { from: '2026-10-01', to: '2026-10-31' } }),
    );
  });

  it('maps settlements newest first as the API sends them', async () => {
    const { repository } = repositoryWith([
      ok([
        {
          id: uuid(50),
          householdId: uuid(100),
          fromMemberId: leo,
          toMemberId: ana,
          amount: eur(3_000),
          method: 'cash',
          note: '',
          settledOn: '2026-10-12',
          createdBy: leo,
          createdAt: '2026-10-12T18:00:00.000Z',
        },
      ]),
    ]);

    const [settlement] = await repository.list('h');

    expect(settlement?.settledOn).toEqual(new Date(2026, 9, 12));
  });

  it.each([
    [{ kind: 'network', message: 'offline' } as const, 'network'],
    [
      {
        kind: 'http',
        status: 422,
        problem: { type: '/problems/invalid-settlement', status: 422 },
      } as const,
      'invalid',
    ],
    [
      {
        kind: 'http',
        status: 404,
        problem: { type: '/problems/household-not-found', status: 404 },
      } as const,
      'forbidden',
    ],
  ])('maps %j to %s', async (error, reason) => {
    const { repository } = repositoryWith([err(error)]);

    await expect(repository.list('h')).rejects.toMatchObject({ reason });
  });
});
