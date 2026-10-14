import { type ChatStreamEvent, chatStreamEventSchema } from '@icount/contracts';
import request from 'supertest';

import {
  AdvisorModel,
  type ChatSink,
  type ChatTurnRequest,
  type RankedInsight,
} from '../src/modules/advisor/domain/advisor.js';
import type { Finding } from '../src/modules/advisor/domain/findings.js';
import { createTestApp, type SignedInUser, type TestApp } from './support/create-test-app.js';

const eur = (amountMinor: number) => ({ amountMinor, currency: 'EUR' });
const TABLES = [
  'advisor_applied_actions',
  'advisor_messages',
  'advisor_conversations',
  'advisor_reports',
  'advisor_consents',
  'budgets',
  'transaction_shares',
  'transactions',
  'categories',
  'household_invitations',
  'household_members',
  'households',
  'users',
];

/** Scripted stand-in for Claude: records what it receives, answers deterministically. */
class FakeAdvisorModel extends AdvisorModel {
  available = true;
  ranking: 'faithful' | 'invented' = 'faithful';
  readonly rankCalls: Finding[][] = [];
  readonly chatRequests: ChatTurnRequest[] = [];

  async rankInsights(findings: readonly Finding[]): Promise<RankedInsight[] | null> {
    this.rankCalls.push([...findings]);
    return findings.map((finding) => ({
      key: finding.key,
      priority: 1,
      title: 'Ojo con la comida',
      body:
        this.ranking === 'faithful'
          ? 'Llevas 435,00 € y tu límite es 400,00 €.'
          : 'Te pasarás unos 120 € a final de mes.',
    }));
  }

  async chat(turn: ChatTurnRequest, sink: ChatSink) {
    this.chatRequests.push(turn);
    // Uses a real tool over the household aggregates, as Claude would.
    const budgets = turn.tools.find((tool) => tool.name === 'get_budgets')!;
    const { content } = await budgets.run({});
    const [food] = content as { spent: string }[];
    sink.text('Este mes llevas ');
    sink.text(`${food?.spent} en comida.`);
    // No savings to plan in this household (an exceeded budget has none): a fixed card.
    sink.plan({
      id: '0199e0a4-5b2c-7c3d-9e4f-00000000aaaa',
      kind: 'savings',
      title: 'Plan de comida',
      summary: 'Vuelve a tu límite.',
      steps: [{ title: 'Ajusta el presupuesto', detail: '', action: null }],
      projection: { monthlySavingMinor: 3_500, interestSavedMinor: null, debtFreeDate: null },
      currency: 'EUR',
    });
    return { text: `Este mes llevas ${food?.spent} en comida.`, refused: false };
  }
}

/** Splits an SSE body into its `data:` events, validated with the contract. */
function events(body: string): ChatStreamEvent[] {
  return body
    .split('\n\n')
    .filter((chunk) => chunk.startsWith('data: '))
    .map((chunk) => chatStreamEventSchema.parse(JSON.parse(chunk.slice('data: '.length))));
}

describe('AI advisor (e2e)', () => {
  let testApp: TestApp;
  const model = new FakeAdvisorModel();
  let ana: SignedInUser;
  let householdId: string;
  const http = () => request(testApp.app.getHttpServer());

  beforeAll(async () => {
    testApp = await createTestApp({ advisor: { anthropicApiKey: null, dailyChatQuota: 2 } }, [
      { provide: AdvisorModel, useValue: model },
    ]);
  });

  beforeEach(async () => {
    await testApp.truncate(...TABLES);
    model.available = true;
    model.ranking = 'faithful';
    model.rankCalls.length = 0;
    model.chatRequests.length = 0;
    ana = await testApp.signIn('ana@icount.app');
    householdId = (
      await http()
        .post('/v1/households')
        .set(ana.headers)
        .send({ name: 'Casa', kind: 'personal' })
        .expect(201)
    ).body.id;
    // An exceeded budget this month: 435 € spent of 400 €.
    const month = new Date().toISOString().slice(0, 7);
    await http()
      .post(`/v1/households/${householdId}/budgets`)
      .set(ana.headers)
      .send({ categoryId: 'food', month, limit: eur(40_000) })
      .expect(201);
    await http()
      .post(`/v1/households/${householdId}/transactions`)
      .set(ana.headers)
      .send({
        type: 'expense',
        amount: eur(43_500),
        categoryId: 'food',
        description: 'Supermercado',
        occurredOn: `${month}-01`,
      })
      .expect(201);
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  const consent = (granted: boolean, version = 1) =>
    http().put('/v1/me/advisor/consent').set(ana.headers).send({ granted, version });

  const chat = (body: Record<string, unknown>, user: SignedInUser = ana) =>
    http()
      .post(`/v1/households/${householdId}/advisor/chat`)
      .set(user.headers)
      .send(body)
      .buffer(true)
      .parse((res, callback) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => (text += chunk));
        res.on('end', () => callback(null, text));
      });

  it('consent is off by default, versioned and required for the model', async () => {
    const initial = await http().get('/v1/me/advisor/consent').set(ana.headers).expect(200);
    expect(initial.body).toEqual({ granted: false, version: 1, grantedAt: null });

    const outdated = await consent(true, 99).expect(422);
    expect(outdated.body.type).toBe('/problems/invalid-consent-version');

    const granted = await consent(true).expect(200);
    expect(granted.body).toMatchObject({ granted: true, version: 1 });
  });

  it('without consent, insights come from the detectors and nothing reaches the model', async () => {
    const report = await http()
      .get(`/v1/households/${householdId}/advisor/insights`)
      .set(ana.headers)
      .expect(200);

    expect(model.rankCalls).toHaveLength(0);
    expect(report.body.insights).toHaveLength(1);
    expect(report.body.insights[0]).toMatchObject({
      kind: 'budget-exceeded',
      title: 'Presupuesto de Comida superado',
      evidence: [
        { label: 'Límite', amount: eur(40_000) },
        { label: 'Gastado', amount: eur(43_500) },
        { label: 'Exceso', amount: eur(3_500) },
      ],
    });
  });

  it('with consent, the model words the insights, but never with invented figures', async () => {
    await consent(true).expect(200);
    const worded = await http()
      .get(`/v1/households/${householdId}/advisor/insights`)
      .set(ana.headers)
      .expect(200);
    expect(worded.body.insights[0].title).toBe('Ojo con la comida');

    // Same data, same day: served from the cache, no second model call.
    await http().get(`/v1/households/${householdId}/advisor/insights`).set(ana.headers).expect(200);
    expect(model.rankCalls).toHaveLength(1);

    // New data and a model that invents a figure: the default text is shown instead.
    model.ranking = 'invented';
    await http()
      .post(`/v1/households/${householdId}/transactions`)
      .set(ana.headers)
      .send({
        type: 'expense',
        amount: eur(1_000),
        categoryId: 'food',
        description: 'Pan',
        occurredOn: `${new Date().toISOString().slice(0, 7)}-02`,
      })
      .expect(201);
    const guarded = await http()
      .get(`/v1/households/${householdId}/advisor/insights`)
      .set(ana.headers)
      .expect(200);
    expect(model.rankCalls).toHaveLength(2);
    expect(guarded.body.insights[0].body).not.toContain('120');
    expect(guarded.body.insights[0].title).toBe('Presupuesto de Comida superado');
  });

  it('chat needs consent and a configured model', async () => {
    const noConsent = await chat({ message: 'Hola' }).expect(403);
    expect(JSON.parse(noConsent.body as string).type).toBe('/problems/advisor-consent-required');

    await consent(true).expect(200);
    model.available = false;
    const unavailable = await chat({ message: 'Hola' }).expect(503);
    expect(JSON.parse(unavailable.body as string).type).toBe('/problems/advisor-unavailable');
  });

  it('streams the answer as SSE: deltas, a plan card and done with the quota left', async () => {
    await consent(true).expect(200);

    const response = await chat({ message: '¿Cómo voy de comida?' }).expect(200);

    expect(response.headers['content-type']).toContain('text/event-stream');
    const stream = events(response.body as string);
    expect(stream.map((event) => event.type)).toEqual(['delta', 'delta', 'plan', 'done']);
    const text = stream.flatMap((event) => (event.type === 'delta' ? [event.text] : [])).join('');
    expect(text.replace(/\s/g, ' ')).toBe('Este mes llevas 435,00 € en comida.');
    expect(stream[2]).toMatchObject({
      type: 'plan',
      plan: { kind: 'savings', projection: { monthlySaving: eur(3_500) } },
    });
    expect(stream.at(-1)).toMatchObject({ type: 'done', remainingMessagesToday: 1 });

    // Only aggregates went to the model: no movement descriptions, no emails.
    const sent = JSON.stringify(model.chatRequests[0]?.context);
    expect(sent).not.toContain('Supermercado');
    expect(sent).not.toContain('ana@icount.app');
  });

  it('keeps the conversation, enforces the daily quota and hides other people’s chats', async () => {
    await consent(true).expect(200);
    const first = events((await chat({ message: 'Primera' }).expect(200)).body as string);
    const done = first.at(-1) as Extract<ChatStreamEvent, { type: 'done' }>;

    await chat({ message: 'Segunda', conversationId: done.conversationId }).expect(200);
    expect(model.chatRequests[1]?.history.map((m) => m.role)).toEqual(['user', 'assistant']);

    const limited = await chat({ message: 'Tercera' }).expect(429);
    expect(JSON.parse(limited.body as string).type).toBe('/problems/advisor-quota-exceeded');

    const luis = await testApp.signIn('luis@icount.app');
    await http()
      .put('/v1/me/advisor/consent')
      .set(luis.headers)
      .send({ granted: true, version: 1 })
      .expect(200);
    await chat({ message: 'Hola', conversationId: done.conversationId }, luis).expect(404);
  });

  it('revoking consent deletes the conversations', async () => {
    await consent(true).expect(200);
    const first = events((await chat({ message: 'Primera' }).expect(200)).body as string);
    const done = first.at(-1) as Extract<ChatStreamEvent, { type: 'done' }>;

    await consent(false).expect(200);
    await consent(true).expect(200);

    await chat({ message: 'Sigo', conversationId: done.conversationId }).expect(404);
  });

  it('records applied actions for evaluation', async () => {
    await http()
      .post(`/v1/households/${householdId}/advisor/applied`)
      .set(ana.headers)
      .send({
        source: { insightId: '0199e0a4-5b2c-7c3d-9e4f-000000000001' },
        action: {
          type: 'set-budget',
          categoryId: 'food',
          month: '2026-11',
          limit: eur(40_000),
        },
      })
      .expect(204);
  });
});
