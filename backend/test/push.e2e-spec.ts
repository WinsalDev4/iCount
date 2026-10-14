import { sql } from 'drizzle-orm';
import request from 'supertest';

import { SendSettleReminders } from '../src/modules/settlements/application/settlements.use-cases.js';
import { createTestApp, type SignedInUser, type TestApp } from './support/create-test-app.js';

const eur = (amountMinor: number) => ({ amountMinor, currency: 'EUR' });
const TABLES = [
  'push_tickets',
  'push_tokens',
  'activities',
  'transaction_approvals',
  'transaction_shares',
  'transactions',
  'categories',
  'household_invitations',
  'household_members',
  'households',
  'users',
];
const device = (name: string) => `ExponentPushToken[${name}]`;

describe('push notifications (e2e)', () => {
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
    testApp.push.clear();
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

  const register = (user: SignedInUser, token: string, platform = 'android') =>
    http()
      .put('/v1/me/push-tokens')
      .set(user.headers)
      .send({ token, platform, deviceName: 'Pixel 8a' });

  const tokensInDatabase = async () =>
    (
      await testApp.db.execute<{ token: string; user_id: string }>(
        sql`select token, user_id from push_tokens order by token`,
      )
    ).rows;

  const spend = (by: SignedInUser, amountMinor: number) =>
    http()
      .post(`/v1/households/${householdId}/transactions`)
      .set(by.headers)
      .send({
        type: 'expense',
        amount: eur(amountMinor),
        categoryId: 'food',
        description: 'Compra',
        occurredOn: '2026-10-10',
        shared: true,
      })
      .expect(201);

  it('registers devices idempotently; a device that changes account moves with it', async () => {
    await register(leo, device('phone')).expect(204);
    await register(leo, device('phone')).expect(204);
    await register(eva, device('tablet'), 'ios').expect(204);
    expect(await tokensInDatabase()).toEqual([
      { token: device('phone'), user_id: leo.userId },
      { token: device('tablet'), user_id: eva.userId },
    ]);

    await register(eva, device('phone')).expect(204);
    expect((await tokensInDatabase()).map((row) => row.user_id)).toEqual([eva.userId, eva.userId]);

    // Signing out unregisters; somebody else's token is left alone.
    await http()
      .delete('/v1/me/push-tokens')
      .set(leo.headers)
      .send({ token: device('tablet') })
      .expect(204);
    await http()
      .delete('/v1/me/push-tokens')
      .set(eva.headers)
      .send({ token: device('tablet') })
      .expect(204);
    expect(await tokensInDatabase()).toEqual([{ token: device('phone'), user_id: eva.userId }]);
  });

  it('rejects anything that is not an Expo push token, and anonymous calls', async () => {
    await register(leo, 'fcm-raw-token').expect(400);
    await http()
      .put('/v1/me/push-tokens')
      .send({ token: device('x'), platform: 'ios' })
      .expect(401);
  });

  it('a new shared expense notifies the members who must approve it, not its author', async () => {
    await register(ana, device('ana'));
    await register(leo, device('leo'));
    await register(eva, device('eva'), 'ios');

    await spend(ana, 1_234);

    await vi.waitFor(() => expect(testApp.push.sent).toHaveLength(2));
    expect(testApp.push.sent.map((push) => push.token).sort()).toEqual([
      device('eva'),
      device('leo'),
    ]);
    expect(testApp.push.sent[0]).toMatchObject({
      title: 'Nuevo gasto compartido en Piso',
      data: { event: 'shared-expense', url: '/household?filter=to-review' },
    });
    expect(testApp.push.sent[0]?.body).toContain('«Compra» · 12,34');
  });

  it('editing it asks for approval again; private movements notify nobody', async () => {
    await register(leo, device('leo'));
    const expense = await spend(ana, 1_000);
    await vi.waitFor(() => expect(testApp.push.sent).toHaveLength(1));

    await http()
      .patch(`/v1/transactions/${expense.body.id}`)
      .set(ana.headers)
      .send({ amount: eur(2_000) })
      .expect(200);
    await vi.waitFor(() => expect(testApp.push.sent).toHaveLength(2));
    expect(testApp.push.sent[1]?.data).toEqual({
      event: 'approval-pending',
      url: '/household?filter=to-review',
    });

    await http()
      .post(`/v1/households/${householdId}/transactions`)
      .set(ana.headers)
      .send({
        type: 'expense',
        amount: eur(500),
        categoryId: 'food',
        description: 'Mío',
        occurredOn: '2026-10-11',
        shared: false,
      })
      .expect(201);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(testApp.push.sent).toHaveLength(2);
  });

  it('forgets devices that Expo reports as not registered', async () => {
    await register(leo, device('uninstalled'));
    testApp.push.dead.add(device('uninstalled'));

    await spend(ana, 1_000);

    await vi.waitFor(async () => expect(await tokensInDatabase()).toEqual([]));
  });

  it('the weekly reminder goes to members who owe at least 10 €, without amounts', async () => {
    await register(leo, device('leo'));
    await register(eva, device('eva'));
    const expense = await spend(ana, 9_000); // 30 € each
    for (const member of [leo, eva]) {
      await http()
        .post(`/v1/transactions/${expense.body.id}/approval`)
        .set(member.headers)
        .send({ decision: 'approve' })
        .expect(200);
    }
    // Eva already paid most of hers back.
    await http()
      .post(`/v1/households/${householdId}/settlements`)
      .set(eva.headers)
      .send({
        fromMemberId: eva.userId,
        toMemberId: ana.userId,
        amount: eur(2_500),
        method: 'bizum',
        settledOn: '2026-10-12',
      })
      .expect(201);
    await vi.waitFor(() => expect(testApp.push.sent).toHaveLength(2));
    testApp.push.clear();

    expect(await testApp.app.get(SendSettleReminders).execute()).toEqual({ reminded: 1 });

    await vi.waitFor(() => expect(testApp.push.sent).toHaveLength(1));
    expect(testApp.push.sent[0]).toMatchObject({
      token: device('leo'),
      title: 'Toca saldar cuentas en Piso',
      data: { event: 'settle-reminder', url: '/settle' },
    });
    expect(testApp.push.sent[0]?.body).not.toMatch(/\d/);
  });
});
