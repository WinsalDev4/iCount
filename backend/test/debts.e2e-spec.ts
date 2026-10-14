import { amortizationSchedule, frenchInstallment } from '@icount/finance';
import request from 'supertest';

import { MaterializeDueRecurringPayments } from '../src/modules/recurring/application/recurring.use-cases.js';
import { createTestApp, type SignedInUser, type TestApp } from './support/create-test-app.js';

const eur = (amountMinor: number) => ({ amountMinor, currency: 'EUR' });
const TABLES = [
  'debt_payments',
  'debts',
  'recurring_occurrences',
  'recurring_payments',
  'transaction_shares',
  'transactions',
  'categories',
  'household_invitations',
  'household_members',
  'households',
  'users',
];

// Far-future loans: nothing has been paid yet whatever the real date is.
const car = {
  name: 'Coche',
  kind: 'car',
  principal: eur(1_500_000),
  annualRateBps: 690,
  aprBps: 745,
  startDate: '2099-01-05',
  termMonths: 48,
};

describe('debts (e2e)', () => {
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

  const createDebt = (body: Record<string, unknown> = {}) =>
    http()
      .post(`/v1/households/${householdId}/debts`)
      .set(ana.headers)
      .send({ ...car, ...body });

  it('computes the French instalment, schedule and end date', async () => {
    const instalment = frenchInstallment(1_500_000, 690, 48);
    const created = await createDebt().expect(201);
    expect(created.body).toMatchObject({
      name: 'Coche',
      principal: eur(1_500_000),
      outstanding: eur(1_500_000),
      monthlyPayment: eur(instalment),
      aprBps: 745,
      endDate: '2102-12-05',
    });

    const schedule = await http()
      .get(`/v1/debts/${created.body.id}/schedule`)
      .set(ana.headers)
      .expect(200);
    const expected = amortizationSchedule({
      principalMinor: 1_500_000,
      annualRateBps: 690,
      paymentMinor: instalment,
      firstPaymentDate: '2099-01-05',
      termMonths: 48,
    });
    expect(schedule.body.rows).toHaveLength(48);
    expect(schedule.body.rows.at(-1).balance).toEqual(eur(0));
    expect(schedule.body.totalInterest).toEqual(eur(expected.totalInterestMinor));
  });

  it('a higher instalment shortens the loan; one below the interest is rejected', async () => {
    const faster = await createDebt({ monthlyPayment: eur(50_000) }).expect(201);
    expect(faster.body.endDate < '2102-12-05').toBe(true);

    const never = await createDebt({ monthlyPayment: eur(5_000) }).expect(422);
    expect(never.body.type).toBe('/problems/invalid-debt');
    await createDebt({ principal: { amountMinor: 1_000, currency: 'USD' } }).expect(422);
  });

  it('updates, lists and deletes debts, hidden from other households', async () => {
    const created = await createDebt().expect(201);
    const updated = await http()
      .patch(`/v1/debts/${created.body.id}`)
      .set(ana.headers)
      .send({ name: 'Coche familiar', aprBps: null })
      .expect(200);
    expect(updated.body).toMatchObject({ name: 'Coche familiar', aprBps: null });

    const list = await http()
      .get(`/v1/households/${householdId}/debts`)
      .set(ana.headers)
      .expect(200);
    expect(list.body).toHaveLength(1);

    const luis = await testApp.signIn('luis@icount.app');
    await http().get(`/v1/debts/${created.body.id}`).set(luis.headers).expect(404);
    await http().delete(`/v1/debts/${created.body.id}`).set(luis.headers).expect(404);

    await http().delete(`/v1/debts/${created.body.id}`).set(ana.headers).expect(204);
    await http().get(`/v1/debts/${created.body.id}`).set(ana.headers).expect(404);
  });

  it('links only "loans" expenses of the household as payments', async () => {
    const debt = await createDebt().expect(201);
    const pay = (categoryId: string) =>
      http()
        .post(`/v1/households/${householdId}/transactions`)
        .set(ana.headers)
        .send({ type: 'expense', amount: eur(35_000), categoryId, occurredOn: '2099-01-05' })
        .expect(201);
    const loan = await pay('loans');
    const food = await pay('food');

    const link = (transactionId: string) =>
      http().put(`/v1/debts/${debt.body.id}/payments/${transactionId}`).set(ana.headers);
    await link(loan.body.id).expect(204);
    await link(loan.body.id).expect(204); // idempotent
    const wrong = await link(food.body.id).expect(422);
    expect(wrong.body.type).toBe('/problems/invalid-debt-payment');

    const payments = await http()
      .get(`/v1/debts/${debt.body.id}/payments`)
      .set(ana.headers)
      .expect(200);
    expect(payments.body.map((tx: { id: string }) => tx.id)).toEqual([loan.body.id]);

    await http()
      .delete(`/v1/debts/${debt.body.id}/payments/${loan.body.id}`)
      .set(ana.headers)
      .expect(204);
    const after = await http()
      .get(`/v1/debts/${debt.body.id}/payments`)
      .set(ana.headers)
      .expect(200);
    expect(after.body).toEqual([]);
  });

  it('the recurring job links each loan instalment to its debt', async () => {
    const debt = await createDebt().expect(201);
    await http()
      .post(`/v1/households/${householdId}/recurring`)
      .set(ana.headers)
      .send({
        name: 'Cuota coche',
        kind: 'loan',
        type: 'expense',
        amount: debt.body.monthlyPayment,
        categoryId: 'loans',
        rule: { unit: 'month', interval: 1, dayOfMonth: 5 },
        startDate: '2099-01-05',
        debtId: debt.body.id,
      })
      .expect(201);

    expect(await testApp.app.get(MaterializeDueRecurringPayments).execute('2099-02-10')).toEqual({
      created: 2,
    });
    const payments = await http()
      .get(`/v1/debts/${debt.body.id}/payments`)
      .set(ana.headers)
      .expect(200);
    expect(payments.body.map((tx: { occurredOn: string }) => tx.occurredOn)).toEqual([
      '2099-02-05',
      '2099-01-05',
    ]);
  });

  it('rejects a recurring payment linked to a debt of another household', async () => {
    const luis = await testApp.signIn('luis@icount.app');
    const other = await http()
      .post('/v1/households')
      .set(luis.headers)
      .send({ name: 'Piso', kind: 'shared' })
      .expect(201);
    const foreign = await http()
      .post(`/v1/households/${other.body.id}/debts`)
      .set(luis.headers)
      .send(car)
      .expect(201);

    const response = await http()
      .post(`/v1/households/${householdId}/recurring`)
      .set(ana.headers)
      .send({
        name: 'Cuota',
        kind: 'loan',
        type: 'expense',
        amount: eur(10_000),
        categoryId: 'loans',
        rule: { unit: 'month', interval: 1, dayOfMonth: 5 },
        startDate: '2099-01-05',
        debtId: foreign.body.id,
      })
      .expect(422);
    expect(response.body.type).toBe('/problems/invalid-debt-payment');
  });

  it('plans avalanche and snowball payoffs over every debt', async () => {
    const expensive = await createDebt({
      name: 'Tarjeta',
      kind: 'credit-card',
      principal: eur(300_000),
      annualRateBps: 2_000,
      termMonths: 24,
    }).expect(201);
    const small = await createDebt({
      name: 'Móvil',
      kind: 'personal',
      principal: eur(60_000),
      annualRateBps: 0,
      termMonths: 12,
    }).expect(201);

    const plan = (strategy: string) =>
      http()
        .get(`/v1/households/${householdId}/debts/strategy`)
        .query({ strategy, extraMonthlyMinor: 20_000 })
        .set(ana.headers)
        .expect(200);
    const avalanche = await plan('avalanche');
    const snowball = await plan('snowball');

    expect(avalanche.body.debts[0].debtId).toBe(expensive.body.id);
    expect(snowball.body.debts[0].debtId).toBe(small.body.id);
    expect(avalanche.body.extraMonthly).toEqual(eur(20_000));
    expect(avalanche.body.totalInterest.amountMinor).toBeLessThanOrEqual(
      snowball.body.totalInterest.amountMinor,
    );
    expect(avalanche.body.debtFreeDate).not.toBeNull();
  });

  it('an empty household is already debt free', async () => {
    const response = await http()
      .get(`/v1/households/${householdId}/debts/strategy`)
      .query({ strategy: 'avalanche' })
      .set(ana.headers)
      .expect(200);
    expect(response.body).toMatchObject({ debts: [], debtFreeDate: null });
  });
});
