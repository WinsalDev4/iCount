import { Money } from '@/core/domain/Money';
import { ActivityError } from '@/features/activity/domain/ActivityError';
import { InMemoryActivityRepository } from '@/features/activity/data/InMemoryActivityRepository';
import { SettlementError } from '@/features/settlements/domain/SettlementError';
import { InMemorySettlementRepository } from '@/features/settlements/data/InMemorySettlementRepository';
import type { CategoryId } from '@/core/domain/Category';

import { ANA, createHouseholdTabTestKit, ME } from '../../testing/householdTabTestKit';

const NOW = new Date(2026, 9, 14, 10);
beforeEach(() => {
  jest.useFakeTimers({
    now: NOW,
    doNotFake: ['setTimeout', 'clearTimeout', 'setImmediate', 'nextTick', 'queueMicrotask'],
  });
});
afterEach(() => jest.useRealTimers());

const eur = (cents: number) => Money.ofMinor(cents, 'EUR');

describe('household ledger + activity + settlements (in memory)', () => {
  it('seeds three movements paid by the partner: two pending, one approved', async () => {
    const { activity } = createHouseholdTabTestKit();
    const page = await activity.list('h1', 'all', {});
    const created = page.items.filter((i) => i.type === 'transaction-created');
    expect(created.map((i) => [i.description, i.approval?.status])).toEqual([
      ['Compra semanal', 'pending'],
      ['Cena en casa de amigos', 'pending'],
      ['Factura de la luz', 'approved'],
    ]);
    expect(created.every((i) => i.actorId === ANA)).toBe(true);
    // The approval I gave to the light bill is in the feed too.
    expect(page.items.some((i) => i.type === 'transaction-approved')).toBe(true);
  });

  it('seeds nothing for a household of one', async () => {
    const { activity } = createHouseholdTabTestKit({ shared: false });
    expect((await activity.list('h1', 'all', {})).items).toEqual([]);
  });

  it('the review filter only has what is pending MY approval', async () => {
    const { activity } = createHouseholdTabTestKit();
    const review = await activity.list('h1', 'to-review', {});
    expect(review.items.map((i) => i.description)).toEqual([
      'Compra semanal',
      'Cena en casa de amigos',
    ]);
  });

  it('what I add myself counts at once; it is never "to review"', async () => {
    const { activity, transactions } = createHouseholdTabTestKit();
    await transactions.create({
      householdId: 'h1',
      type: 'expense',
      amount: eur(1_000),
      categoryId: 'food' as CategoryId,
      description: 'Pan',
      occurredAt: new Date(2026, 9, 14),
      shared: true,
    });
    const all = await activity.list('h1', 'all', {});
    const mine = all.items.find((i) => i.description === 'Pan');
    expect(mine).toMatchObject({ actorId: ME, approval: { status: 'approved' } });
    expect(
      (await activity.list('h1', 'to-review', {})).items.map((i) => i.description),
    ).not.toContain('Pan');
  });

  it('pages the feed with a cursor', async () => {
    const { activity } = createHouseholdTabTestKit();
    const first = await activity.list('h1', 'all', { limit: 2 });
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).toBe('2');
    const second = await activity.list('h1', 'all', {
      limit: 2,
      cursor: first.nextCursor ?? undefined,
    });
    expect(second.items.length).toBeGreaterThan(0);
    expect(second.items[0]?.id).not.toBe(first.items[0]?.id);
  });

  describe('approvals', () => {
    it('approving moves the movement into the balance and out of the review list', async () => {
      const { activity, settlements } = createHouseholdTabTestKit();
      const before = await settlements.balance('h1');
      expect(before.pendingApprovalCount).toBe(2);
      // Only the approved light bill (61,25 €) counts: Leo is first, so he owes the extra cent.
      expect(before.members.find((m) => m.memberId === ME)?.net.amountMinor).toBe(-3_063);

      const review = await activity.list('h1', 'to-review', {});
      const groceries = review.items[0];
      const decided = await activity.decide(groceries?.transactionId ?? '', {
        decision: 'approve',
      });
      expect(decided.approval).toMatchObject({ status: 'approved', decidedBy: ME });

      const after = await settlements.balance('h1');
      expect(after.pendingApprovalCount).toBe(1);
      expect(after.members.find((m) => m.memberId === ME)?.net.amountMinor).toBe(-3_063 - 4_320);
      expect((await activity.list('h1', 'to-review', {})).items).toHaveLength(1);
    });

    it('a rejected movement does not count and keeps its reason', async () => {
      const { activity, settlements } = createHouseholdTabTestKit();
      const [dinner] = (await activity.list('h1', 'to-review', {})).items.slice(1);
      const decided = await activity.decide(dinner?.transactionId ?? '', {
        decision: 'reject',
        reason: 'No estuve',
      });
      expect(decided.approval).toMatchObject({ status: 'rejected', reason: 'No estuve' });
      const balance = await settlements.balance('h1');
      expect(balance.members.find((m) => m.memberId === ME)?.net.amountMinor).toBe(-3_063);
      expect(balance.pendingApprovalCount).toBe(1);
    });

    it('cannot decide twice, on your own movement, or on a missing one', async () => {
      const { activity, transactions } = createHouseholdTabTestKit();
      const [first] = (await activity.list('h1', 'to-review', {})).items;
      await activity.decide(first?.transactionId ?? '', { decision: 'approve' });
      await expect(
        activity.decide(first?.transactionId ?? '', { decision: 'approve' }),
      ).rejects.toEqual(new ActivityError('already-decided'));

      const own = await transactions.create({
        householdId: 'h1',
        type: 'expense',
        amount: eur(500),
        categoryId: 'food' as CategoryId,
        description: 'Mío',
        occurredAt: new Date(2026, 9, 14),
        shared: true,
      });
      await expect(activity.decide(own.id, { decision: 'approve' })).rejects.toEqual(
        new ActivityError('cannot-approve-own'),
      );
      await expect(activity.decide('nope', { decision: 'approve' })).rejects.toEqual(
        new ActivityError('not-found'),
      );
    });
  });

  describe('comments', () => {
    it('adds comments oldest first and counts them in the feed', async () => {
      const { activity } = createHouseholdTabTestKit();
      const [item] = (await activity.list('h1', 'to-review', {})).items;
      const id = item?.transactionId ?? '';
      await activity.addComment(id, 'Uno');
      await activity.addComment(id, 'Dos');
      expect((await activity.comments(id)).map((c) => c.body)).toEqual(['Uno', 'Dos']);
      expect((await activity.comments(id))[0]).toMatchObject({ authorId: ME, transactionId: id });
      const feed = await activity.list('h1', 'all', {});
      expect(feed.items.find((i) => i.id === `created:${id}`)?.commentCount).toBe(2);
      expect(feed.items.filter((i) => i.type === 'comment-added')).toHaveLength(2);
      await expect(activity.addComment('nope', 'x')).rejects.toEqual(
        new ActivityError('not-found'),
      );
    });
  });

  describe('settlements', () => {
    it('a payment from the debtor settles the balance and appears in the feed', async () => {
      const { settlements, activity } = createHouseholdTabTestKit();
      const created = await settlements.create({
        householdId: 'h1',
        from: ME,
        to: ANA,
        amount: eur(3_063),
        method: 'bizum',
        note: 'Luz',
        settledOn: new Date(2026, 9, 14),
      });
      expect(created).toMatchObject({ from: ME, to: ANA, method: 'bizum', note: 'Luz' });
      expect(await settlements.list('h1')).toHaveLength(1);

      const balance = await settlements.balance('h1');
      expect(balance.suggestedTransfers).toEqual([]);
      expect(balance.members.every((m) => m.net.amountMinor === 0)).toBe(true);

      const feed = await activity.list('h1', 'all', {});
      expect(feed.items.find((i) => i.type === 'settlement-created')).toMatchObject({
        actorId: ME,
        description: 'Luz',
      });
    });

    it('filters the balance by period', async () => {
      const { settlements } = createHouseholdTabTestKit();
      const none = await settlements.balance('h1', {
        from: new Date(2026, 0, 1),
        to: new Date(2026, 0, 31),
      });
      expect(none.suggestedTransfers).toEqual([]);
    });

    it('rejects payments between people who are not members, and lists newest first', async () => {
      const { settlements } = createHouseholdTabTestKit();
      const input = {
        householdId: 'h1',
        from: ME,
        to: ANA,
        amount: eur(100),
        method: 'cash' as const,
        note: '',
        settledOn: new Date(2026, 9, 1),
      };
      await expect(settlements.create({ ...input, to: 'stranger' as typeof ANA })).rejects.toEqual(
        new SettlementError('invalid'),
      );
      await settlements.create(input);
      await settlements.create({ ...input, settledOn: new Date(2026, 9, 10) });
      expect((await settlements.list('h1')).map((s) => s.settledOn.getDate())).toEqual([10, 1]);
    });
  });

  it('the adapters are built from the same ledger', () => {
    const { activity, settlements } = createHouseholdTabTestKit();
    expect(activity).toBeInstanceOf(InMemoryActivityRepository);
    expect(settlements).toBeInstanceOf(InMemorySettlementRepository);
  });
});
