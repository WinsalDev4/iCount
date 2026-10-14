import type { HouseholdId, UserId } from '@/core/domain/Ids';
import { Money } from '@/core/domain/Money';

import {
  InMemoryHouseholdRepository,
  MEMORY_EXPIRED_CODE,
  MEMORY_UNKNOWN_CODE,
} from '../InMemoryHouseholdRepository';

const NOW = new Date('2026-10-14T10:00:00Z');
const make = () =>
  new InMemoryHouseholdRepository({ now: () => NOW, randomCode: () => 'ABCD2345' });

describe('InMemoryHouseholdRepository', () => {
  it('starts with no households', async () => {
    expect(await make().getMine()).toEqual([]);
  });

  it('creates households with increasing ids, equal split and me as admin', async () => {
    const repository = make();
    const first = await repository.create({ name: 'Yo', kind: 'personal', currency: 'EUR' });
    const second = await repository.create({ name: 'Casa', kind: 'shared', currency: 'EUR' });
    expect(first.id).not.toBe(second.id);
    expect(second.splitRule).toEqual({ kind: 'equal' });
    expect(second.members).toEqual([
      expect.objectContaining({ role: 'admin', monthlyIncome: null }),
    ]);
    expect(await repository.getMine()).toHaveLength(2);
  });

  it('does not let callers mutate its state through the returned list', async () => {
    const repository = make();
    await repository.create({ name: 'Yo', kind: 'personal', currency: 'EUR' });
    const mine = (await repository.getMine()) as unknown[];
    mine.length = 0;
    expect(await repository.getMine()).toHaveLength(1);
  });

  it('invites with a code valid for 48 hours', async () => {
    const repository = make();
    const household = await repository.create({ name: 'Casa', kind: 'shared', currency: 'EUR' });
    const invite = await repository.createInvite(household.id);
    expect(invite.code).toBe('ABCD2345');
    expect(invite.expiresAt.getTime() - NOW.getTime()).toBe(48 * 60 * 60 * 1000);
    await expect(repository.createInvite('x' as HouseholdId)).rejects.toMatchObject({
      reason: 'not-found',
    });
  });

  it('generates 8-character codes from an unambiguous alphabet by default', async () => {
    const repository = new InMemoryHouseholdRepository();
    const household = await repository.create({ name: 'Casa', kind: 'shared', currency: 'EUR' });
    for (let i = 0; i < 20; i++) {
      const { code } = await repository.createInvite(household.id);
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/); // no I, O, 0, 1
    }
  });

  it('joining any valid code puts me in the demo household as a plain member', async () => {
    const repository = make();
    const joined = await repository.join('wxyz-6789');
    expect(joined.name).toBe('Casa Ana & Leo');
    expect(joined.members.map((m) => [m.displayName, m.role])).toEqual([
      ['Ana', 'admin'],
      [null, 'member'],
    ]);
    expect(await repository.getMine()).toHaveLength(1);
  });

  it('has magic codes for the error paths', async () => {
    const repository = make();
    await expect(repository.join(MEMORY_EXPIRED_CODE)).rejects.toMatchObject({
      reason: 'expired-invite',
    });
    await expect(repository.join(MEMORY_UNKNOWN_CODE)).rejects.toMatchObject({
      reason: 'invalid-invite',
    });
  });

  it('cannot join with the code it just created', async () => {
    const repository = make();
    const household = await repository.create({ name: 'Casa', kind: 'shared', currency: 'EUR' });
    await repository.createInvite(household.id);
    await expect(repository.join('ABCD2345')).rejects.toMatchObject({ reason: 'already-member' });
  });

  it('only the admin changes the split rule', async () => {
    const repository = make();
    const joined = await repository.join('WXYZ6789');
    await expect(repository.setSplitRule(joined.id, { kind: 'equal' })).rejects.toMatchObject({
      reason: 'forbidden',
    });
    const own = await repository.create({ name: 'Mía', kind: 'shared', currency: 'EUR' });
    const updated = await repository.setSplitRule(own.id, { kind: 'income-proportional' });
    expect(updated.splitRule).toEqual({ kind: 'income-proportional' });
    await expect(
      repository.setSplitRule('nope' as HouseholdId, { kind: 'equal' }),
    ).rejects.toMatchObject({ reason: 'not-found' });
  });

  it('accepts a custom rule only with one valid share per member', async () => {
    const repository = make();
    const own = await repository.create({ name: 'Mía', kind: 'shared', currency: 'EUR' });
    const me = 'user-me' as UserId;
    const food = 'food' as never;
    const ok = await repository.setSplitRule(own.id, {
      kind: 'custom',
      categories: [{ categoryId: food, shares: [{ memberId: me, basisPoints: 10_000 }] }],
    });
    expect(ok.splitRule.kind).toBe('custom');

    await expect(
      repository.setSplitRule(own.id, {
        kind: 'custom',
        categories: [{ categoryId: food, shares: [{ memberId: me, basisPoints: 5_000 }] }],
      }),
    ).rejects.toMatchObject({ reason: 'invalid-split-rule' });
  });

  it('stores my declared income and leaves other members alone', async () => {
    const repository = make();
    const joined = await repository.join('WXYZ6789');
    const updated = await repository.setMyIncome(joined.id, Money.ofMinor(185_000, 'EUR'));
    const incomes = updated.members.map((m) => m.monthlyIncome?.amountMinor ?? null);
    expect(incomes).toEqual([200_000, 185_000]);
  });

  it('can act as another person', async () => {
    const repository = new InMemoryHouseholdRepository({
      me: { userId: 'u9' as UserId, email: 'leo@casa.app', displayName: 'Leo' },
    });
    const household = await repository.create({ name: 'Casa', kind: 'shared', currency: 'EUR' });
    expect(household.members[0]).toMatchObject({ userId: 'u9', displayName: 'Leo' });
  });
});
