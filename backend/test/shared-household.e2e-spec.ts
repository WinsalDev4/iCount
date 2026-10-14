import request from 'supertest';

import { createTestApp, type SignedInUser, type TestApp } from './support/create-test-app.js';

const eur = (amountMinor: number) => ({ amountMinor, currency: 'EUR' });
const TABLES = [
  'comments',
  'activities',
  'settlements',
  'transaction_approvals',
  'transaction_shares',
  'transactions',
  'categories',
  'household_invitations',
  'household_members',
  'households',
  'users',
];

interface Balance {
  members: { memberId: string; paid: { amountMinor: number }; net: { amountMinor: number } }[];
  suggestedTransfers: { fromMemberId: string; toMemberId: string; amount: unknown }[];
  pendingApprovalCount: number;
}

describe('shared household: balances, approvals, activity (e2e)', () => {
  let testApp: TestApp;
  let ana: SignedInUser;
  let leo: SignedInUser;
  let eva: SignedInUser;
  let householdId: string;
  const http = () => request(testApp.app.getHttpServer());

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  beforeEach(async () => {
    await testApp.truncate(...TABLES);
    ana = await testApp.signIn('ana@icount.app');
    leo = await testApp.signIn('leo@icount.app');
    eva = await testApp.signIn('eva@icount.app');
    const household = await http()
      .post('/v1/households')
      .set(ana.headers)
      .send({ name: 'Piso', kind: 'shared' })
      .expect(201);
    householdId = household.body.id;
    for (const member of [leo, eva]) {
      const invitation = await http()
        .post(`/v1/households/${householdId}/invitations`)
        .set(ana.headers)
        .expect(201);
      await http()
        .post('/v1/households/join')
        .set(member.headers)
        .send({ code: invitation.body.code })
        .expect(200);
    }
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  const spend = (by: SignedInUser, amountMinor: number, shared = true) =>
    http()
      .post(`/v1/households/${householdId}/transactions`)
      .set(by.headers)
      .send({
        type: 'expense',
        amount: eur(amountMinor),
        categoryId: 'food',
        description: 'Compra',
        occurredOn: '2026-10-10',
        shared,
      })
      .expect(201);

  const decide = (by: SignedInUser, transactionId: string, body: Record<string, unknown>) =>
    http().post(`/v1/transactions/${transactionId}/approval`).set(by.headers).send(body);

  const balance = async (by: SignedInUser = ana, query: Record<string, string> = {}) =>
    (
      await http()
        .get(`/v1/households/${householdId}/balance`)
        .query(query)
        .set(by.headers)
        .expect(200)
    ).body as Balance;

  const netOf = (body: Balance, member: SignedInUser) =>
    body.members.find((m) => m.memberId === member.userId)!.net.amountMinor;

  const toReview = async (by: SignedInUser) =>
    (
      await http()
        .get(`/v1/households/${householdId}/activity`)
        .query({ filter: 'to-review' })
        .set(by.headers)
        .expect(200)
    ).body.items as { transactionId: string; approval: { status: string } }[];

  it('a shared expense only counts once the other members approve it', async () => {
    // 100,01 € among three: the odd cents go to the payer.
    const expense = await spend(ana, 10_001);
    const shares = expense.body.shares as { memberId: string; amount: { amountMinor: number } }[];
    expect(shares.reduce((sum, share) => sum + share.amount.amountMinor, 0)).toBe(10_001);

    const before = await balance();
    expect(before.pendingApprovalCount).toBe(1);
    expect(before.members.map((m) => m.net.amountMinor)).toEqual([0, 0, 0]);
    expect(before.suggestedTransfers).toEqual([]);

    expect(await toReview(ana)).toEqual([]); // nobody reviews their own
    expect((await toReview(leo)).map((item) => item.transactionId)).toEqual([expense.body.id]);

    const first = await decide(leo, expense.body.id, { decision: 'approve' }).expect(200);
    expect(first.body).toMatchObject({
      type: 'transaction-approved',
      actorId: leo.userId,
      approval: { status: 'pending', decidedBy: leo.userId },
    });
    expect(await toReview(leo)).toEqual([]);
    const second = await decide(eva, expense.body.id, { decision: 'approve' }).expect(200);
    expect(second.body.approval.status).toBe('approved');

    const after = await balance();
    const shareOf = (member: SignedInUser) =>
      shares.find((share) => share.memberId === member.userId)!.amount.amountMinor;
    expect(netOf(after, ana)).toBe(10_001 - shareOf(ana));
    expect(netOf(after, leo)).toBe(-shareOf(leo));
    expect(netOf(after, eva)).toBe(-shareOf(eva));
    expect(after.members.reduce((sum, m) => sum + m.net.amountMinor, 0)).toBe(0);
    expect(after.pendingApprovalCount).toBe(0);
    expect(after.suggestedTransfers).toEqual(
      expect.arrayContaining([
        { fromMemberId: leo.userId, toMemberId: ana.userId, amount: eur(shareOf(leo)) },
        { fromMemberId: eva.userId, toMemberId: ana.userId, amount: eur(shareOf(eva)) },
      ]),
    );
  });

  it('rejections need a reason and keep the movement out of the balance', async () => {
    const expense = await spend(leo, 5_000);

    await decide(eva, expense.body.id, { decision: 'reject' }).expect(400);
    const rejected = await decide(eva, expense.body.id, {
      decision: 'reject',
      reason: 'Esto no era del piso',
    }).expect(200);
    expect(rejected.body.approval).toMatchObject({
      status: 'rejected',
      decidedBy: eva.userId,
      reason: 'Esto no era del piso',
    });

    const late = await decide(ana, expense.body.id, { decision: 'approve' }).expect(409);
    expect(late.body.type).toBe('/problems/already-decided');
    const own = await decide(leo, expense.body.id, { decision: 'approve' }).expect(422);
    expect(own.body.type).toBe('/problems/cannot-approve-own');

    const body = await balance();
    expect(body.members.every((m) => m.net.amountMinor === 0)).toBe(true);
    expect(body.pendingApprovalCount).toBe(0);
  });

  it('private movements never need approval nor count; editing a shared one asks again', async () => {
    await spend(ana, 9_999, false);
    const expense = await spend(ana, 3_000);
    await decide(leo, expense.body.id, { decision: 'approve' }).expect(200);
    await decide(eva, expense.body.id, { decision: 'approve' }).expect(200);
    expect(netOf(await balance(), ana)).toBe(2_000);

    await http()
      .patch(`/v1/transactions/${expense.body.id}`)
      .set(ana.headers)
      .send({ amount: eur(6_000) })
      .expect(200);

    const body = await balance();
    expect(netOf(body, ana)).toBe(0);
    expect(body.pendingApprovalCount).toBe(1);
  });

  it('a settlement counts at once and brings the debtor to zero', async () => {
    const expense = await spend(ana, 9_000);
    await decide(leo, expense.body.id, { decision: 'approve' }).expect(200);
    await decide(eva, expense.body.id, { decision: 'approve' }).expect(200);

    const settlement = await http()
      .post(`/v1/households/${householdId}/settlements`)
      .set(leo.headers)
      .send({
        fromMemberId: leo.userId,
        toMemberId: ana.userId,
        amount: eur(3_000),
        method: 'bizum',
        settledOn: '2026-10-12',
      })
      .expect(201);
    expect(settlement.body).toMatchObject({ method: 'bizum', note: '', createdBy: leo.userId });

    const body = await balance();
    expect([netOf(body, ana), netOf(body, leo), netOf(body, eva)]).toEqual([3_000, 0, -3_000]);
    expect(body.suggestedTransfers).toEqual([
      { fromMemberId: eva.userId, toMemberId: ana.userId, amount: eur(3_000) },
    ]);

    // The period filter leaves the settlement (and the expense) out.
    const october10 = await balance(ana, { from: '2026-10-01', to: '2026-10-10' });
    expect([netOf(october10, ana), netOf(october10, leo)]).toEqual([6_000, -3_000]);

    const list = await http()
      .get(`/v1/households/${householdId}/settlements`)
      .set(eva.headers)
      .expect(200);
    expect(list.body.map((s: { id: string }) => s.id)).toEqual([settlement.body.id]);

    await http()
      .post(`/v1/households/${householdId}/settlements`)
      .set(leo.headers)
      .send({
        fromMemberId: leo.userId,
        toMemberId: leo.userId,
        amount: eur(1),
        method: 'cash',
        settledOn: '2026-10-12',
      })
      .expect(400);
  });

  it('records the activity of the household, newest first, with comments and pages', async () => {
    const expense = await spend(ana, 1_500);
    await decide(leo, expense.body.id, { decision: 'approve' }).expect(200);

    const comment = await http()
      .post(`/v1/transactions/${expense.body.id}/comments`)
      .set(eva.headers)
      .send({ body: '  ¿Esto incluye el vino?  ' })
      .expect(201);
    expect(comment.body).toMatchObject({ authorId: eva.userId, body: '¿Esto incluye el vino?' });
    const comments = await http()
      .get(`/v1/transactions/${expense.body.id}/comments`)
      .set(ana.headers)
      .expect(200);
    expect(comments.body).toHaveLength(1);

    await http().delete(`/v1/transactions/${expense.body.id}`).set(ana.headers).expect(204);

    const feed = await http()
      .get(`/v1/households/${householdId}/activity`)
      .set(ana.headers)
      .expect(200);
    expect(feed.body.items.map((item: { type: string }) => item.type)).toEqual([
      'transaction-deleted',
      'comment-added',
      'transaction-approved',
      'transaction-created',
      'member-joined',
      'member-joined',
    ]);
    expect(feed.body.items[0]).toMatchObject({ amount: eur(1_500), description: 'Compra' });
    expect(feed.body.nextCursor).toBeNull();

    const firstPage = await http()
      .get(`/v1/households/${householdId}/activity`)
      .query({ limit: 4 })
      .set(ana.headers)
      .expect(200);
    const secondPage = await http()
      .get(`/v1/households/${householdId}/activity`)
      .query({ limit: 4, cursor: firstPage.body.nextCursor })
      .set(ana.headers)
      .expect(200);
    expect(secondPage.body.items).toHaveLength(2);
    expect(secondPage.body.nextCursor).toBeNull();
  });

  it('comment counts follow the movement while it exists', async () => {
    const expense = await spend(ana, 1_000);
    for (const body of ['uno', 'dos']) {
      await http()
        .post(`/v1/transactions/${expense.body.id}/comments`)
        .set(leo.headers)
        .send({ body })
        .expect(201);
    }

    const feed = await http()
      .get(`/v1/households/${householdId}/activity`)
      .set(ana.headers)
      .expect(200);
    const created = feed.body.items.find(
      (item: { type: string }) => item.type === 'transaction-created',
    );
    expect(created).toMatchObject({ commentCount: 2, approval: { status: 'pending' } });
  });

  it('hides everything from outsiders', async () => {
    const outsider = await testApp.signIn('mallory@icount.app');
    const expense = await spend(ana, 1_000);

    await http().get(`/v1/households/${householdId}/balance`).set(outsider.headers).expect(404);
    await http().get(`/v1/households/${householdId}/activity`).set(outsider.headers).expect(404);
    await decide(outsider, expense.body.id, { decision: 'approve' }).expect(404);
    await http()
      .post(`/v1/transactions/${expense.body.id}/comments`)
      .set(outsider.headers)
      .send({ body: 'hola' })
      .expect(404);
  });
});
