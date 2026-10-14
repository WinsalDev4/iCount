import type { CategoryId } from '@/core/domain/Category';
import type { HouseholdId, UserId } from '@/core/domain/Ids';
import { Money } from '@/core/domain/Money';

import { InMemoryHouseholdRepository } from '../../../data/InMemoryHouseholdRepository';
import type { HouseholdRepository } from '../../HouseholdRepository';
import { CreateHousehold } from '../CreateHousehold';
import { CreateInvite } from '../CreateInvite';
import { GetMyHouseholds } from '../GetMyHouseholds';
import { JoinHousehold } from '../JoinHousehold';
import { SetMyIncome } from '../SetMyIncome';
import { SetSplitRule } from '../SetSplitRule';

const repo = () => new InMemoryHouseholdRepository({ randomCode: () => 'ABCD2345' });

describe('CreateHousehold', () => {
  it('creates with a cleaned name and the default currency', async () => {
    const created = await new CreateHousehold(repo()).execute({
      name: '  Casa   Ana ',
      kind: 'shared',
    });
    expect(created).toMatchObject({ name: 'Casa Ana', kind: 'shared', currency: 'EUR' });
    expect(created.splitRule).toEqual({ kind: 'equal' });
    expect(created.members).toHaveLength(1);
    expect(created.members[0]?.role).toBe('admin');
  });

  it('accepts another currency', async () => {
    const created = await new CreateHousehold(repo()).execute({
      name: 'Trip',
      kind: 'personal',
      currency: 'USD',
    });
    expect(created.currency).toBe('USD');
  });

  it.each(['', '   ', 'a'.repeat(61)])(
    'refuses the name %j without touching the repository',
    async (name) => {
      const repository = repo();
      const create = jest.spyOn(repository, 'create');
      await expect(
        new CreateHousehold(repository).execute({ name, kind: 'personal' }),
      ).rejects.toThrow(RangeError);
      expect(create).not.toHaveBeenCalled();
    },
  );
});

describe('GetMyHouseholds', () => {
  it('is empty until one is created', async () => {
    const repository = repo();
    expect(await new GetMyHouseholds(repository).execute()).toEqual([]);
    await new CreateHousehold(repository).execute({ name: 'Yo', kind: 'personal' });
    expect(await new GetMyHouseholds(repository).execute()).toHaveLength(1);
  });
});

describe('CreateInvite', () => {
  it('returns a code that expires in 48 hours', async () => {
    const now = new Date('2026-10-14T10:00:00Z');
    const repository = new InMemoryHouseholdRepository({
      now: () => now,
      randomCode: () => 'ABCD2345',
    });
    const household = await new CreateHousehold(repository).execute({
      name: 'Casa',
      kind: 'shared',
    });
    const invite = await new CreateInvite(repository).execute(household.id);
    expect(invite.code).toBe('ABCD2345');
    expect(invite.expiresAt).toEqual(new Date('2026-10-16T10:00:00Z'));
  });

  it('fails for a household that does not exist', async () => {
    await expect(new CreateInvite(repo()).execute('nope' as HouseholdId)).rejects.toMatchObject({
      reason: 'not-found',
    });
  });
});

describe('JoinHousehold', () => {
  it('normalizes the code before sending it', async () => {
    const repository = repo();
    const join = jest.spyOn(repository, 'join');
    const household = await new JoinHousehold(repository).execute(' abcd-2345 ');
    expect(join).toHaveBeenCalledWith('ABCD2345');
    expect(household.kind).toBe('shared');
    expect(household.members.map((m) => m.role)).toEqual(['admin', 'member']);
  });

  it.each(['', 'ABC', 'ABCD-234', 'ABCD-2345-9'])(
    'refuses a malformed code (%j) locally',
    async (code) => {
      const repository = repo();
      const join = jest.spyOn(repository, 'join');
      await expect(new JoinHousehold(repository).execute(code)).rejects.toMatchObject({
        reason: 'invalid-invite',
      });
      expect(join).not.toHaveBeenCalled();
    },
  );

  it('shows the repository errors for expired and unknown codes', async () => {
    const join = new JoinHousehold(repo());
    await expect(join.execute('EXPIRED1')).rejects.toMatchObject({ reason: 'expired-invite' });
    await expect(join.execute('UNKNOWN1')).rejects.toMatchObject({ reason: 'invalid-invite' });
  });

  it('refuses to join the household whose code you created', async () => {
    const repository = repo();
    const household = await new CreateHousehold(repository).execute({
      name: 'Casa',
      kind: 'shared',
    });
    await new CreateInvite(repository).execute(household.id);
    await expect(new JoinHousehold(repository).execute('ABCD2345')).rejects.toMatchObject({
      reason: 'already-member',
    });
  });
});

describe('SetSplitRule', () => {
  async function sharedWithPartner() {
    const repository = repo();
    const household = await repository.join('ZZZZ9999'); // me + Ana
    return { repository, household };
  }
  const me = 'user-me' as UserId;
  const ana = 'user-ana' as UserId;
  const food = 'food' as CategoryId;

  it('a member who joined cannot change the rule: only the admin can', async () => {
    const { repository, household } = await sharedWithPartner();
    // In the joined demo household Ana is the admin, so "me" cannot change it…
    await expect(
      new SetSplitRule(repository).execute(household.id, { kind: 'income-proportional' }),
    ).rejects.toMatchObject({ reason: 'forbidden' });
  });

  it('lets the admin change the rule', async () => {
    const repository = repo();
    const household = await new CreateHousehold(repository).execute({
      name: 'Casa',
      kind: 'shared',
    });
    const updated = await new SetSplitRule(repository).execute(household.id, {
      kind: 'income-proportional',
    });
    expect(updated.splitRule).toEqual({ kind: 'income-proportional' });
    expect((await repository.getMine())[0]?.splitRule).toEqual({ kind: 'income-proportional' });
  });

  it('rejects custom shares that do not add up to 100 % without calling the repository', async () => {
    const repository = repo();
    const set = jest.spyOn(repository, 'setSplitRule');
    const bad = {
      kind: 'custom' as const,
      categories: [
        {
          categoryId: food,
          shares: [
            { memberId: me, basisPoints: 6_000 },
            { memberId: ana, basisPoints: 3_000 },
          ],
        },
      ],
    };
    await expect(
      new SetSplitRule(repository).execute('h' as HouseholdId, bad),
    ).rejects.toMatchObject({
      reason: 'invalid-split-rule',
    });
    expect(set).not.toHaveBeenCalled();
  });

  it('rejects a category listed twice', async () => {
    const repository = repo();
    const shares = [
      { memberId: me, basisPoints: 5_000 },
      { memberId: ana, basisPoints: 5_000 },
    ];
    await expect(
      new SetSplitRule(repository).execute('h' as HouseholdId, {
        kind: 'custom',
        categories: [
          { categoryId: food, shares },
          { categoryId: food, shares },
        ],
      }),
    ).rejects.toMatchObject({ reason: 'invalid-split-rule' });
  });

  it('the repository rejects shares for people who are not members', async () => {
    const repository = repo();
    const household = await new CreateHousehold(repository).execute({
      name: 'Casa',
      kind: 'shared',
    });
    await expect(
      new SetSplitRule(repository).execute(household.id, {
        kind: 'custom',
        categories: [
          {
            categoryId: food,
            shares: [
              { memberId: me, basisPoints: 5_000 },
              { memberId: 'stranger' as UserId, basisPoints: 5_000 },
            ],
          },
        ],
      }),
    ).rejects.toMatchObject({ reason: 'invalid-split-rule' });
  });
});

describe('SetMyIncome', () => {
  it('stores the declared income', async () => {
    const repository = repo();
    const household = await new CreateHousehold(repository).execute({
      name: 'Casa',
      kind: 'shared',
    });
    const updated = await new SetMyIncome(repository).execute(
      household.id,
      Money.ofMinor(185_000, 'EUR'),
    );
    expect(updated.members[0]?.monthlyIncome?.amountMinor).toBe(185_000);
  });

  it('refuses a negative income without calling the repository', async () => {
    const repository: HouseholdRepository = repo();
    const set = jest.spyOn(repository, 'setMyIncome');
    await expect(
      new SetMyIncome(repository).execute('h' as HouseholdId, Money.ofMinor(-1, 'EUR')),
    ).rejects.toThrow(RangeError);
    expect(set).not.toHaveBeenCalled();
  });
});
