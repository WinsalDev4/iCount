import { randomUUID } from 'node:crypto';

import request, { type Response } from 'supertest';

import { createTestApp, type SignedInUser, type TestApp } from './support/create-test-app.js';

const eur = (amountMinor: number) => ({ amountMinor, currency: 'EUR' });

describe('categories and transactions (e2e)', () => {
  let testApp: TestApp;
  let ana: SignedInUser;
  let leo: SignedInUser;
  let householdId: string;
  const http = () => request(testApp.app.getHttpServer());

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  beforeEach(async () => {
    await testApp.truncate(
      'transaction_shares',
      'transactions',
      'categories',
      'household_invitations',
      'household_members',
      'households',
      'users',
    );
    ana = await testApp.signIn('ana@icount.app');
    leo = await testApp.signIn('leo@icount.app');
    const created = await http()
      .post('/v1/households')
      .set(ana.headers)
      .send({ name: 'Piso', kind: 'shared' })
      .expect(201);
    householdId = created.body.id;
    const invitation = await http()
      .post(`/v1/households/${householdId}/invitations`)
      .set(ana.headers)
      .expect(201);
    await http()
      .post('/v1/households/join')
      .set(leo.headers)
      .send({ code: invitation.body.code })
      .expect(200);
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  const create = (user: SignedInUser, body: Record<string, unknown>) =>
    http()
      .post(`/v1/households/${householdId}/transactions`)
      .set(user.headers)
      .send({ type: 'expense', categoryId: 'food', occurredOn: '2026-10-14', ...body });

  describe('categories', () => {
    it('lists the built-in categories in Spanish plus the custom ones', async () => {
      await http()
        .post(`/v1/households/${householdId}/categories`)
        .set(leo.headers)
        .send({ name: 'Mascotas', icon: 'paw', kind: 'expense' })
        .expect(201);

      const response = await http()
        .get(`/v1/households/${householdId}/categories`)
        .set(ana.headers)
        .expect(200);

      expect(response.body.slice(0, 2)).toEqual([
        {
          id: 'food',
          name: 'Comida',
          icon: 'cart',
          kind: 'expense',
          isDefault: true,
          householdId: null,
        },
        {
          id: 'bills',
          name: 'Facturas',
          icon: 'bolt',
          kind: 'expense',
          isDefault: true,
          householdId: null,
        },
      ]);
      expect(response.body).toHaveLength(10);
      expect(response.body.at(-1)).toMatchObject({
        name: 'Mascotas',
        isDefault: false,
        householdId,
      });
    });

    it('rejects unknown categories and categories of the wrong type', async () => {
      const unknown = await create(ana, { amount: eur(100), categoryId: randomUUID() }).expect(422);
      expect(unknown.body.type).toBe('/problems/unknown-category');

      const salaryAsExpense = await create(ana, { amount: eur(100), categoryId: 'salary' }).expect(
        422,
      );
      expect(salaryAsExpense.body.type).toBe('/problems/category-type-mismatch');
    });
  });

  describe('creating', () => {
    it('splits a shared expense; the odd cent goes to the payer', async () => {
      const response = await create(ana, {
        amount: eur(1_001),
        categoryId: 'bills',
        description: ' Luz ',
        payerId: leo.userId,
        shared: true,
      }).expect(201);

      expect(response.body).toMatchObject({
        type: 'expense',
        amount: eur(1_001),
        description: 'Luz',
        payerId: leo.userId,
        shared: true,
      });
      expect(response.body.shares).toEqual(
        expect.arrayContaining([
          { memberId: ana.userId, amount: eur(500) },
          { memberId: leo.userId, amount: eur(501) },
        ]),
      );
    });

    it('is idempotent with a client-generated id', async () => {
      const id = randomUUID();
      const first = await create(ana, { id, amount: eur(2_500) }).expect(201);
      const replay = await create(ana, { id, amount: eur(2_500) }).expect(200);

      expect(replay.body).toEqual(first.body);
      await create(leo, { id, amount: eur(2_500) }).expect(409);
    });

    it('rejects payers from outside and amounts in another currency', async () => {
      const eva = await testApp.signIn('eva@icount.app');
      const outsider = await create(ana, { amount: eur(100), payerId: eva.userId }).expect(422);
      expect(outsider.body.type).toBe('/problems/payer-not-member');

      const dollars = await create(ana, { amount: { amountMinor: 100, currency: 'USD' } }).expect(
        422,
      );
      expect(dollars.body.type).toBe('/problems/currency-mismatch');
    });
  });

  describe('listing', () => {
    beforeEach(async () => {
      const rows = [
        {
          occurredOn: '2026-10-01',
          amount: eur(245_000),
          type: 'income',
          categoryId: 'salary',
          description: 'Nómina',
        },
        {
          occurredOn: '2026-10-02',
          amount: eur(85_000),
          categoryId: 'housing',
          description: 'Alquiler',
          shared: true,
        },
        {
          occurredOn: '2026-10-04',
          amount: eur(9_435),
          categoryId: 'food',
          description: 'Mercadona 100% fresco',
        },
        {
          occurredOn: '2026-10-06',
          amount: eur(6_890),
          categoryId: 'bills',
          description: 'Luz',
          payerId: leo.userId,
          shared: true,
        },
        { occurredOn: '2026-10-06', amount: eur(1_200), categoryId: 'food', description: 'Pan' },
        {
          occurredOn: '2026-11-01',
          amount: eur(5_000),
          categoryId: 'leisure',
          description: 'Cine',
        },
      ];
      for (const row of rows) await create(ana, row).expect(201);
    });

    it('pages with an opaque cursor, newest first, without gaps or duplicates', async () => {
      const seen: string[] = [];
      let cursor: string | null = null;
      let pages = 0;
      do {
        const response: Response = await http()
          .get(`/v1/households/${householdId}/transactions`)
          .query({ limit: 2, ...(cursor ? { cursor } : {}) })
          .set(ana.headers)
          .expect(200);
        seen.push(...response.body.items.map((item: { description: string }) => item.description));
        cursor = response.body.nextCursor;
        pages += 1;
      } while (cursor);

      expect(pages).toBe(3);
      expect(seen).toEqual(['Cine', 'Pan', 'Luz', 'Mercadona 100% fresco', 'Alquiler', 'Nómina']);
    });

    it('filters by type, category, member, shared, dates and text', async () => {
      const list = async (query: Record<string, string>) =>
        (
          await http()
            .get(`/v1/households/${householdId}/transactions`)
            .query(query)
            .set(ana.headers)
            .expect(200)
        ).body.items.map((item: { description: string }) => item.description);

      expect(await list({ type: 'income' })).toEqual(['Nómina']);
      expect(await list({ categoryId: 'food' })).toEqual(['Pan', 'Mercadona 100% fresco']);
      expect(await list({ shared: 'true' })).toEqual(['Luz', 'Alquiler']);
      expect(await list({ memberId: leo.userId })).toEqual(['Luz', 'Alquiler']);
      expect(await list({ from: '2026-10-02', to: '2026-10-04' })).toEqual([
        'Mercadona 100% fresco',
        'Alquiler',
      ]);
      // `%` is a literal character, not a wildcard.
      expect(await list({ q: '100%' })).toEqual(['Mercadona 100% fresco']);
      expect(await list({ q: 'LUZ' })).toEqual(['Luz']);
    });

    it('summarises a month and its days', async () => {
      const summary = await http()
        .get(`/v1/households/${householdId}/summary`)
        .query({ month: '2026-10' })
        .set(ana.headers)
        .expect(200);
      expect(summary.body).toEqual({
        month: '2026-10',
        income: eur(245_000),
        expenses: eur(102_525),
        balance: eur(142_475),
        expensesByCategory: [
          { categoryId: 'housing', amount: eur(85_000) },
          { categoryId: 'food', amount: eur(10_635) },
          { categoryId: 'bills', amount: eur(6_890) },
        ],
      });

      const daily = await http()
        .get(`/v1/households/${householdId}/daily-totals`)
        .query({ month: '2026-10' })
        .set(ana.headers)
        .expect(200);
      expect(daily.body.days).toEqual([
        { date: '2026-10-01', income: eur(245_000), expenses: eur(0) },
        { date: '2026-10-02', income: eur(0), expenses: eur(85_000) },
        { date: '2026-10-04', income: eur(0), expenses: eur(9_435) },
        { date: '2026-10-06', income: eur(0), expenses: eur(8_090) },
      ]);
    });

    it('rejects tampered cursors', async () => {
      const response = await http()
        .get(`/v1/households/${householdId}/transactions`)
        .query({ cursor: 'not-a-cursor' })
        .set(ana.headers)
        .expect(422);
      expect(response.body.type).toBe('/problems/invalid-cursor');
    });
  });

  describe('editing and access', () => {
    it('recomputes shares on edit and deletes', async () => {
      const created = await create(ana, { amount: eur(1_000), shared: true }).expect(201);
      const id = created.body.id;

      const edited = await http()
        .patch(`/v1/transactions/${id}`)
        .set(leo.headers)
        .send({ amount: eur(3_001) })
        .expect(200);
      expect(edited.body.shares).toEqual(
        expect.arrayContaining([
          { memberId: ana.userId, amount: eur(1_501) },
          { memberId: leo.userId, amount: eur(1_500) },
        ]),
      );

      await http().patch(`/v1/transactions/${id}`).set(ana.headers).send({}).expect(400);
      await http().delete(`/v1/transactions/${id}`).set(ana.headers).expect(204);
      await http().get(`/v1/transactions/${id}`).set(ana.headers).expect(404);
    });

    it('hides movements from people outside the household', async () => {
      const created = await create(ana, { amount: eur(1_000) }).expect(201);
      const eva = await testApp.signIn('eva@icount.app');

      await http().get(`/v1/transactions/${created.body.id}`).set(eva.headers).expect(404);
      await http().delete(`/v1/transactions/${created.body.id}`).set(eva.headers).expect(404);
      await http().get(`/v1/households/${householdId}/transactions`).set(eva.headers).expect(404);
    });

    it('does not split movements of personal households', async () => {
      const personal = await http()
        .post('/v1/households')
        .set(ana.headers)
        .send({ name: 'Yo', kind: 'personal' })
        .expect(201);

      const response = await http()
        .post(`/v1/households/${personal.body.id}/transactions`)
        .set(ana.headers)
        .send({
          type: 'expense',
          categoryId: 'food',
          occurredOn: '2026-10-14',
          amount: eur(100),
          shared: true,
        })
        .expect(422);
      expect(response.body.type).toBe('/problems/not-shared-household');
    });
  });
});
