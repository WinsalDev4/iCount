import { eq } from 'drizzle-orm';
import request from 'supertest';

import { householdInvitationsTable } from '../src/modules/households/infrastructure/persistence/households.schema.js';
import { createTestApp, type SignedInUser, type TestApp } from './support/create-test-app.js';

describe('/v1/households (e2e)', () => {
  let testApp: TestApp;
  let ana: SignedInUser;
  let leo: SignedInUser;
  const http = () => request(testApp.app.getHttpServer());

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  beforeEach(async () => {
    await testApp.truncate('household_invitations', 'household_members', 'households', 'users');
    ana = await testApp.signIn('ana@icount.app');
    leo = await testApp.signIn('leo@icount.app');
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  async function createHousehold(owner: SignedInUser, kind: 'shared' | 'personal' = 'shared') {
    const response = await http()
      .post('/v1/households')
      .set(owner.headers)
      .send({ name: ' Piso Lavapiés ', kind })
      .expect(201);
    return response.body as { id: string };
  }

  async function invite(owner: SignedInUser, householdId: string) {
    const response = await http()
      .post(`/v1/households/${householdId}/invitations`)
      .set(owner.headers)
      .expect(201);
    return response.body as { code: string; expiresAt: string };
  }

  it('requires authentication', async () => {
    await http().get('/v1/households').expect(401);
  });

  it('creates a household with its creator as admin', async () => {
    const response = await http()
      .post('/v1/households')
      .set(ana.headers)
      .send({ name: ' Piso Lavapiés ', kind: 'shared' })
      .expect(201);

    expect(response.body).toMatchObject({
      name: 'Piso Lavapiés',
      kind: 'shared',
      currency: 'EUR',
      splitRule: { type: 'equal' },
      members: [
        { userId: ana.userId, email: 'ana@icount.app', role: 'admin', monthlyIncome: null },
      ],
    });
  });

  it("lists only my households and hides other people's", async () => {
    const anas = await createHousehold(ana);
    await createHousehold(leo);

    const mine = await http().get('/v1/households').set(ana.headers).expect(200);
    expect(mine.body.map((h: { id: string }) => h.id)).toEqual([anas.id]);

    const notMine = await http().get(`/v1/households/${anas.id}`).set(leo.headers).expect(404);
    expect(notMine.body.type).toBe('/problems/household-not-found');
  });

  it('lets someone join once with an invite code, typed loosely', async () => {
    const household = await createHousehold(ana);
    const { code } = await invite(ana, household.id);
    expect(code).toMatch(/^[A-HJKMNP-Z2-9]{8}$/);

    const typed = `${code.slice(0, 4).toLowerCase()}-${code.slice(4)}`;
    const joined = await http()
      .post('/v1/households/join')
      .set(leo.headers)
      .send({ code: typed })
      .expect(200);
    expect(
      joined.body.members.map((m: { email: string; role: string }) => [m.email, m.role]),
    ).toEqual([
      ['ana@icount.app', 'admin'],
      ['leo@icount.app', 'member'],
    ]);

    const eva = await testApp.signIn('eva@icount.app');
    const reused = await http()
      .post('/v1/households/join')
      .set(eva.headers)
      .send({ code })
      .expect(404);
    expect(reused.body.type).toBe('/problems/invalid-invite');
  });

  it('rejects expired codes and members joining again', async () => {
    const household = await createHousehold(ana);
    const expired = await invite(ana, household.id);
    await testApp.db
      .update(householdInvitationsTable)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(householdInvitationsTable.code, expired.code));

    const late = await http()
      .post('/v1/households/join')
      .set(leo.headers)
      .send({ code: expired.code })
      .expect(422);
    expect(late.body.type).toBe('/problems/expired-invite');

    const fresh = await invite(ana, household.id);
    await http()
      .post('/v1/households/join')
      .set(ana.headers)
      .send({ code: fresh.code })
      .expect(409);
  });

  it('lets only one of two people use the same code at once', async () => {
    const household = await createHousehold(ana);
    const { code } = await invite(ana, household.id);
    const eva = await testApp.signIn('eva@icount.app');

    const results = await Promise.all(
      [leo, eva].map((user) => http().post('/v1/households/join').set(user.headers).send({ code })),
    );

    expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([200, 404]);
    const final = await http().get(`/v1/households/${household.id}`).set(ana.headers).expect(200);
    expect(final.body.members).toHaveLength(2);
  });

  it('reserves invitations and split rules to admins of shared households', async () => {
    const household = await createHousehold(ana);
    const { code } = await invite(ana, household.id);
    await http().post('/v1/households/join').set(leo.headers).send({ code }).expect(200);

    await http().post(`/v1/households/${household.id}/invitations`).set(leo.headers).expect(403);
    await http()
      .put(`/v1/households/${household.id}/split-rule`)
      .set(leo.headers)
      .send({ splitRule: { type: 'income-proportional' } })
      .expect(403);

    const personal = await createHousehold(ana, 'personal');
    const refused = await http()
      .post(`/v1/households/${personal.id}/invitations`)
      .set(ana.headers)
      .expect(422);
    expect(refused.body.type).toBe('/problems/personal-household');
  });

  it('validates custom split rules against the members', async () => {
    const household = await createHousehold(ana);
    const { code } = await invite(ana, household.id);
    await http().post('/v1/households/join').set(leo.headers).send({ code }).expect(200);
    const rule = (shares: { memberId: string; basisPoints: number }[]) => ({
      splitRule: { type: 'custom', categories: [{ categoryId: 'housing', shares }] },
    });

    const saved = await http()
      .put(`/v1/households/${household.id}/split-rule`)
      .set(ana.headers)
      .send(
        rule([
          { memberId: ana.userId, basisPoints: 6_000 },
          { memberId: leo.userId, basisPoints: 4_000 },
        ]),
      )
      .expect(200);
    expect(saved.body.splitRule.categories[0].shares).toHaveLength(2);

    const stranger = await testApp.signIn('eva@icount.app');
    const invalid = await http()
      .put(`/v1/households/${household.id}/split-rule`)
      .set(ana.headers)
      .send(rule([{ memberId: stranger.userId, basisPoints: 10_000 }]))
      .expect(422);
    expect(invalid.body.type).toBe('/problems/invalid-split-rule');
  });

  it('stores my declared income in the household currency', async () => {
    const household = await createHousehold(ana);

    const updated = await http()
      .put(`/v1/households/${household.id}/members/me/income`)
      .set(ana.headers)
      .send({ monthlyIncome: { amountMinor: 245_000, currency: 'EUR' } })
      .expect(200);
    expect(updated.body.members[0].monthlyIncome).toEqual({
      amountMinor: 245_000,
      currency: 'EUR',
    });

    const wrong = await http()
      .put(`/v1/households/${household.id}/members/me/income`)
      .set(ana.headers)
      .send({ monthlyIncome: { amountMinor: 100, currency: 'USD' } })
      .expect(422);
    expect(wrong.body.type).toBe('/problems/currency-mismatch');
  });
});
