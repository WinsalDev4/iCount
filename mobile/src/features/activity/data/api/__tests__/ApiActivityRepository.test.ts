import { activityItemDtoSchema } from '@icount/contracts';

import { err, ok } from '@/core/domain/Result';
import type { HttpClient } from '@/core/network/httpClient';

import { ApiActivityRepository } from '../ApiActivityRepository';
import { toActivityItem, toDecisionRequest } from '../activityMapper';

const uuid = (n: number) => `0199e0a4-5b2c-7c3d-9e4f-${String(n).padStart(12, '0')}`;
const item = (overrides: Record<string, unknown> = {}) =>
  activityItemDtoSchema.parse({
    id: uuid(1),
    householdId: uuid(100),
    type: 'transaction-created',
    actorId: uuid(10),
    occurredAt: '2026-10-14T09:00:00.000Z',
    transactionId: uuid(20),
    settlementId: null,
    amount: { amountMinor: 1_500, currency: 'EUR' },
    description: 'Compra',
    approval: { status: 'pending', decidedBy: null, decidedAt: null, reason: null },
    commentCount: 2,
    ...overrides,
  });

function repositoryWith(responses: Awaited<ReturnType<HttpClient['request']>>[]) {
  const request = jest.fn(async () => responses.shift()!);
  return {
    request,
    repository: new ApiActivityRepository({ request } as unknown as HttpClient),
  };
}

describe('activity mapping', () => {
  it('maps amounts, approval and dates', () => {
    const mapped = toActivityItem(item());

    expect(mapped.amount?.amountMinor).toBe(1_500);
    expect(mapped.approval).toEqual({
      status: 'pending',
      decidedBy: null,
      decidedAt: null,
      reason: null,
    });
    expect(mapped.occurredAt.toISOString()).toBe('2026-10-14T09:00:00.000Z');
  });

  it('shows event types from a newer API as unknown instead of failing', () => {
    expect(toActivityItem(item({ type: 'budget-exceeded' })).type).toBe('unknown');
  });

  it('only sends a reason when rejecting', () => {
    expect(toDecisionRequest({ decision: 'approve' })).toEqual({ decision: 'approve' });
    expect(toDecisionRequest({ decision: 'reject', reason: 'No era del piso' })).toEqual({
      decision: 'reject',
      reason: 'No era del piso',
    });
  });
});

describe('ApiActivityRepository', () => {
  it('pages the feed with its filter and cursor', async () => {
    const { repository, request } = repositoryWith([ok({ items: [item()], nextCursor: 'c2' })]);

    const page = await repository.list('h', 'to-review', { cursor: 'c1', limit: 20 });

    expect(page.nextCursor).toBe('c2');
    expect(request).toHaveBeenCalledWith(
      '/v1/households/h/activity',
      expect.objectContaining({ query: { filter: 'to-review', cursor: 'c1', limit: 20 } }),
    );
  });

  it('approves a movement and returns the new event', async () => {
    const decided = item({
      type: 'transaction-approved',
      approval: {
        status: 'approved',
        decidedBy: uuid(11),
        decidedAt: '2026-10-14T10:00:00.000Z',
        reason: null,
      },
    });
    const { repository, request } = repositoryWith([ok(decided)]);

    const result = await repository.decide(uuid(20), { decision: 'approve' });

    expect(result.approval?.status).toBe('approved');
    expect(request).toHaveBeenCalledWith(
      `/v1/transactions/${uuid(20)}/approval`,
      expect.objectContaining({ method: 'POST', body: { decision: 'approve' } }),
    );
  });

  it('adds and lists comments', async () => {
    const comment = {
      id: uuid(30),
      transactionId: uuid(20),
      authorId: uuid(10),
      body: '¿Incluye el vino?',
      createdAt: '2026-10-14T10:00:00.000Z',
    };
    const { repository } = repositoryWith([ok(comment), ok([comment])]);

    await expect(repository.addComment(uuid(20), '¿Incluye el vino?')).resolves.toMatchObject({
      body: '¿Incluye el vino?',
    });
    await expect(repository.comments(uuid(20))).resolves.toHaveLength(1);
  });

  it.each([
    ['already-decided', 409, 'already-decided'],
    ['cannot-approve-own', 422, 'cannot-approve-own'],
    ['not-an-approver', 403, 'forbidden'],
    ['transaction-not-found', 404, 'not-found'],
  ])('maps the problem %s to %s', async (code, status, reason) => {
    const { repository } = repositoryWith([
      err({ kind: 'http', status, problem: { type: `/problems/${code}`, status } }),
    ]);

    await expect(repository.decide(uuid(20), { decision: 'approve' })).rejects.toMatchObject({
      reason,
    });
  });
});
