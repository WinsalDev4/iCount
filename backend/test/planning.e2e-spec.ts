import request from 'supertest';

import { MaterializeDueRecurringPayments } from '../src/modules/recurring/application/recurring.use-cases.js';
import { createTestApp, type SignedInUser, type TestApp } from './support/create-test-app.js';

const eur = (amountMinor: number) => ({ amountMinor, currency: 'EUR' });
const TABLES = [
  'recurring_occurrences',
  'recurring_payments',
  'budgets',
  'transaction_shares',
  'transactions',
  'categories',
  'household_invitations',
  'household_members',
  'households',
  'users',
];

describe('budgets and recurring payments (e2e)', () => {
  let testApp: TestApp;
  let ana: SignedInUser;
  let householdId: string;
  const http = () => request(testApp.app.getHttpServer());

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  beforeEach(async () => {
    await testApp.truncate(...TABLES);
    ana = await testApp.signIn('ana@icount.app');
    const created = await http()
      .post('/v1/households')
      .set(ana.headers)
      .send({ name: 'Casa', kind: 'shared' })
      .expect(201);
    householdId = created.body.id;
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  const spend = (categoryId: string, amountMinor: number, occurredOn: string) =>
    http()
      .post(`/v1/households/${householdId}/transactions`)
      .set(ana.headers)
      .send({ type: 'expense', amount: eur(amountMinor), categoryId, occurredOn })
      .expect(201);

  const createBudget = (categoryId: string, limitMinor: number, month = '2026-10') =>
    http()
      .post(`/v1/households/${householdId}/budgets`)
      .set(ana.headers)
      .send({ categoryId, month, limit: eur(limitMinor) });

  describe('budgets', () => {
    it('reports spending and what is left (negative when exceeded)', async () => {
      await createBudget('food', 40_000).expect(201);
      await createBudget('leisure', 10_000).expect(201);
      await spend('food', 30_000, '2026-10-03');
      await spend('food', 13_500, '2026-10-20');
      await spend('food', 99_999, '2026-11-01'); // other month: does not count
      await spend('leisure', 2_500, '2026-10-10');

      const response = await http()
        .get(`/v1/households/${householdId}/budgets`)
        .query({ month: '2026-10' })
        .set(ana.headers)
        .expect(200);

      expect(
        response.body.map((b: { categoryId: string; spent: unknown; remaining: unknown }) => [
          b.categoryId,
          b.spent,
          b.remaining,
        ]),
      ).toEqual([
        ['food', eur(43_500), eur(-3_500)],
        ['leisure', eur(2_500), eur(7_500)],
      ]);
    });

    it('allows one budget per category and month, and only expense categories', async () => {
      await createBudget('food', 40_000).expect(201);
      const duplicate = await createBudget('food', 1_000).expect(409);
      expect(duplicate.body.type).toBe('/problems/duplicate-budget');
      await createBudget('food', 40_000, '2026-11').expect(201);

      const salary = await createBudget('salary', 1_000).expect(422);
      expect(salary.body.type).toBe('/problems/category-type-mismatch');
    });

    it('moves amounts between budgets keeping the total, never down to zero', async () => {
      const food = (await createBudget('food', 40_000).expect(201)).body;
      const leisure = (await createBudget('leisure', 10_000).expect(201)).body;

      const moved = await http()
        .post(`/v1/households/${householdId}/budgets/move`)
        .set(ana.headers)
        .send({ fromBudgetId: leisure.id, toBudgetId: food.id, amount: eur(5_000) })
        .expect(200);
      expect(moved.body.map((b: { limit: unknown }) => b.limit)).toEqual([eur(5_000), eur(45_000)]);

      const tooMuch = await http()
        .post(`/v1/households/${householdId}/budgets/move`)
        .set(ana.headers)
        .send({ fromBudgetId: leisure.id, toBudgetId: food.id, amount: eur(5_000) })
        .expect(422);
      expect(tooMuch.body.type).toBe('/problems/insufficient-amount');
    });

    it('updates and deletes budgets, hidden from other households', async () => {
      const food = (await createBudget('food', 40_000).expect(201)).body;
      const eva = await testApp.signIn('eva@icount.app');

      await http()
        .patch(`/v1/budgets/${food.id}`)
        .set(eva.headers)
        .send({ limit: eur(1) })
        .expect(404);
      const updated = await http()
        .patch(`/v1/budgets/${food.id}`)
        .set(ana.headers)
        .send({ limit: eur(50_000) })
        .expect(200);
      expect(updated.body.limit).toEqual(eur(50_000));
      await http().delete(`/v1/budgets/${food.id}`).set(ana.headers).expect(204);
    });
  });

  describe('recurring payments', () => {
    const createRecurring = (body: Record<string, unknown>) =>
      http()
        .post(`/v1/households/${householdId}/recurring`)
        .set(ana.headers)
        .send({
          name: 'Luz',
          kind: 'bill',
          type: 'expense',
          amount: eur(6_890),
          categoryId: 'bills',
          rule: { unit: 'month', interval: 1, dayOfMonth: 31 },
          ...body,
        });

    it('computes the next due date with month-end adjustment and lists upcoming dues', async () => {
      const created = await createRecurring({ startDate: '2099-01-15' }).expect(201);
      expect(created.body.nextDueDate).toBe('2099-01-31');

      const upcoming = await http()
        .get(`/v1/households/${householdId}/recurring/upcoming`)
        .query({ from: '2099-01-01', to: '2099-04-30' })
        .set(ana.headers)
        .expect(200);
      expect(upcoming.body.map((due: { dueDate: string }) => due.dueDate)).toEqual([
        '2099-01-31',
        '2099-02-28',
        '2099-03-31',
        '2099-04-30',
      ]);
    });

    it('the daily job turns due dates into movements once, catching up missed days', async () => {
      const created = await createRecurring({
        name: 'Seguro',
        categoryId: 'insurance',
        rule: { unit: 'month', interval: 1, dayOfMonth: 8 },
        startDate: '2099-01-08',
      }).expect(201);
      const job = testApp.app.get(MaterializeDueRecurringPayments);

      // The server was down for months: one run creates every missed occurrence.
      expect(await job.execute('2099-03-10')).toEqual({ created: 3 });
      expect(await job.execute('2099-03-10')).toEqual({ created: 0 });
      // Concurrent runs (two instances) do not duplicate either.
      const concurrent = await Promise.all([job.execute('2099-04-08'), job.execute('2099-04-08')]);
      expect(concurrent.reduce((sum, run) => sum + run.created, 0)).toBe(1);

      const movements = await http()
        .get(`/v1/households/${householdId}/transactions`)
        .query({ categoryId: 'insurance' })
        .set(ana.headers)
        .expect(200);
      expect(movements.body.items.map((tx: { occurredOn: string }) => tx.occurredOn)).toEqual([
        '2099-04-08',
        '2099-03-08',
        '2099-02-08',
        '2099-01-08',
      ]);

      const after = await http()
        .get(`/v1/households/${householdId}/recurring`)
        .set(ana.headers)
        .expect(200);
      expect(after.body.find((r: { id: string }) => r.id === created.body.id).nextDueDate).toBe(
        '2099-05-08',
      );
    });

    it('stops after the end date', async () => {
      await createRecurring({
        rule: { unit: 'month', interval: 1, dayOfMonth: 1 },
        startDate: '2099-01-01',
        endDate: '2099-02-15',
      }).expect(201);

      expect(await testApp.app.get(MaterializeDueRecurringPayments).execute('2099-12-31')).toEqual({
        created: 2,
      });
      const list = await http().get(`/v1/households/${householdId}/recurring`).set(ana.headers);
      expect(list.body[0].nextDueDate).toBeNull();
    });

    it('rejects end dates before the start and wrong categories', async () => {
      const backwards = await createRecurring({
        startDate: '2099-05-01',
        endDate: '2099-01-01',
      }).expect(422);
      expect(backwards.body.type).toBe('/problems/invalid-recurring-payment');
      await createRecurring({ startDate: '2099-01-01', categoryId: 'salary' }).expect(422);
    });
  });
});
