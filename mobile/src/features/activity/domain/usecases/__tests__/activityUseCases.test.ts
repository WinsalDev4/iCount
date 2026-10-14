import { Money } from '@/core/domain/Money';
import { SettlementError } from '@/features/settlements/domain/SettlementError';
import {
  CreateSettlement,
  GetBalance,
} from '@/features/settlements/domain/usecases/SettlementUseCases';
import type { UserId } from '@/core/domain/Ids';

import { ActivityError } from '../../ActivityError';
import type { ActivityRepository } from '../../ActivityRepository';
import { AddComment, DecideApproval } from '../ActivityUseCases';

const repo = () => {
  const decide = jest.fn(async () => ({}) as never);
  const addComment = jest.fn(async () => ({}) as never);
  return { decide, addComment } as unknown as Pick<ActivityRepository, 'decide' | 'addComment'> & {
    decide: jest.Mock;
    addComment: jest.Mock;
  };
};

describe('DecideApproval', () => {
  it('approves without a reason', async () => {
    const r = repo();
    await new DecideApproval(r).execute('t', { decision: 'approve' });
    expect(r.decide).toHaveBeenCalledWith('t', { decision: 'approve' });
  });

  it('trims the reason of a rejection and refuses an empty or long one', async () => {
    const r = repo();
    const use = new DecideApproval(r);
    await use.execute('t', { decision: 'reject', reason: '  No fui  ' });
    expect(r.decide).toHaveBeenCalledWith('t', { decision: 'reject', reason: 'No fui' });
    await expect(use.execute('t', { decision: 'reject', reason: '   ' })).rejects.toBeInstanceOf(
      ActivityError,
    );
    await expect(
      use.execute('t', { decision: 'reject', reason: 'x'.repeat(141) }),
    ).rejects.toBeInstanceOf(ActivityError);
    expect(r.decide).toHaveBeenCalledTimes(1);
  });
});

describe('AddComment', () => {
  it('trims and refuses empty or huge comments', async () => {
    const r = repo();
    const use = new AddComment(r);
    await use.execute('t', '  hola ');
    expect(r.addComment).toHaveBeenCalledWith('t', 'hola');
    await expect(use.execute('t', '   ')).rejects.toBeInstanceOf(ActivityError);
    await expect(use.execute('t', 'x'.repeat(501))).rejects.toBeInstanceOf(ActivityError);
  });
});

describe('settlement use cases', () => {
  const input = {
    householdId: 'h',
    from: 'a' as UserId,
    to: 'b' as UserId,
    amount: Money.ofMinor(500, 'EUR'),
    method: 'cash' as const,
    note: ' hola ',
    settledOn: new Date(2026, 9, 14),
  };

  it('CreateSettlement validates before storing', async () => {
    const create = jest.fn(async () => ({}) as never);
    const use = new CreateSettlement({ create });
    await use.execute(input);
    expect(create).toHaveBeenCalledWith({ ...input, note: 'hola' });
    for (const bad of [
      { ...input, to: input.from },
      { ...input, amount: Money.ofMinor(0, 'EUR') },
      { ...input, note: 'x'.repeat(141) },
    ]) {
      await expect(use.execute(bad)).rejects.toEqual(new SettlementError('invalid'));
    }
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('GetBalance rejects a backwards period', async () => {
    const balance = jest.fn(async () => ({}) as never);
    await expect(
      new GetBalance({ balance }).execute('h', {
        from: new Date(2026, 5, 2),
        to: new Date(2026, 5, 1),
      }),
    ).rejects.toEqual(new SettlementError('invalid'));
    expect(balance).not.toHaveBeenCalled();
  });
});
