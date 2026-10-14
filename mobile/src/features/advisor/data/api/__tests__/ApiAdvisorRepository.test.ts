import { err, ok } from '@/core/domain/Result';
import type { HttpClient } from '@/core/network/httpClient';
import type { Authenticator } from '@/core/network/withAuthentication';

import type { ChatEvent } from '../../../domain/Advisor';
import { ApiAdvisorRepository } from '../ApiAdvisorRepository';
import { createEventStreamClient, type EventStreamClient, sseData } from '../eventStream';

const uuid = (n: number) => `0199e0a4-5b2c-7c3d-9e4f-${String(n).padStart(12, '0')}`;
const eur = (amountMinor: number) => ({ amountMinor, currency: 'EUR' });

/** A body that arrives in the given byte chunks (to cut events and characters anywhere). */
function streamOf(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

function splitAt(text: string, ...cuts: number[]): Uint8Array[] {
  const bytes = new TextEncoder().encode(text);
  const points = [0, ...[...cuts].sort((a, b) => a - b), bytes.length];
  return points.slice(1).map((end, i) => bytes.slice(points[i], end));
}

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of iterable) items.push(item);
  return items;
}

const sse = (...events: unknown[]) => events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('');

describe('sseData', () => {
  it('rebuilds events cut anywhere, even inside a multi-byte character', async () => {
    const text = sse(
      { type: 'delta', text: 'Llevas 435,00 € en comida' },
      { type: 'delta', text: '¿Algo más?' },
    );
    const euro = new TextEncoder().encode(text).indexOf(0xe2); // first byte of "€"

    const data = await collect(sseData(streamOf(splitAt(text, euro + 1, euro + 2, 40))));

    expect(data.map((d) => JSON.parse(d).text)).toEqual([
      'Llevas 435,00 € en comida',
      '¿Algo más?',
    ]);
  });

  it('handles CRLF, comments, multi-line data and a last event without blank line', async () => {
    const text = ': keep-alive\r\n\r\ndata: a\r\ndata: b\r\n\r\ndata: tail';

    expect(await collect(sseData(streamOf(splitAt(text, 3))))).toEqual(['a\nb', 'tail']);
  });
});

describe('createEventStreamClient', () => {
  const auth = (tokens: (string | null)[]): Authenticator & { refreshed: string[] } => {
    const refreshed: string[] = [];
    return {
      refreshed,
      accessToken: async () => tokens[0] ?? null,
      refresh: async (rejected) => {
        refreshed.push(rejected);
        return tokens[1] ?? null;
      },
    };
  };

  it('sends the bearer token and refreshes once on a 401', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 401 }))
      .mockResolvedValueOnce(
        new Response(streamOf(splitAt(sse({ type: 'delta', text: 'ok' }))), {
          status: 200,
        }),
      );
    const session = auth(['old', 'new']);
    const client = createEventStreamClient({
      baseUrl: 'http://api/',
      auth: session,
      fetch: fetchFn,
    });

    const result = await client.post('/v1/x', { message: 'Hola' }, new AbortController().signal);

    expect(result.ok).toBe(true);
    expect(session.refreshed).toEqual(['old']);
    expect(fetchFn).toHaveBeenLastCalledWith(
      'http://api/v1/x',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ message: 'Hola' }),
        headers: expect.objectContaining({ Authorization: 'Bearer new' }),
      }),
    );
  });

  it('returns the problem of an error answer, and flags network failures as offline', async () => {
    const problem = { type: '/problems/advisor-quota-exceeded', status: 429, detail: 'Mañana más' };
    const client = createEventStreamClient({
      baseUrl: 'http://api',
      auth: auth(['t']),
      fetch: jest
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify(problem), { status: 429 }))
        .mockRejectedValueOnce(new TypeError('Network request failed')),
    });
    const signal = new AbortController().signal;

    expect(await client.post('/v1/x', {}, signal)).toEqual({
      ok: false,
      problem: expect.objectContaining({ detail: 'Mañana más' }),
      offline: false,
    });
    expect(await client.post('/v1/x', {}, signal)).toEqual({
      ok: false,
      problem: null,
      offline: true,
    });
  });
});

describe('ApiAdvisorRepository', () => {
  function repositoryWith(
    responses: Awaited<ReturnType<HttpClient['request']>>[],
    stream?: EventStreamClient,
  ) {
    const request = jest.fn(async () => responses.shift()!);
    const events = stream ?? { post: jest.fn() };
    return {
      request,
      repository: new ApiAdvisorRepository({ request } as unknown as HttpClient, events),
    };
  }

  it('reads and sets the versioned consent', async () => {
    const { repository, request } = repositoryWith([
      ok({ granted: true, version: 1, grantedAt: '2026-10-14T10:00:00.000Z' }),
    ]);

    await expect(repository.setConsent({ granted: true, version: 1 })).resolves.toEqual({
      granted: true,
      version: 1,
    });
    expect(request).toHaveBeenCalledWith(
      '/v1/me/advisor/consent',
      expect.objectContaining({ method: 'PUT', body: { granted: true, version: 1 } }),
    );
  });

  it('maps insights with money, evidence and one-tap actions', async () => {
    const { repository } = repositoryWith([
      ok({
        generatedAt: '2026-10-14T06:00:00.000Z',
        totalPotentialMonthlySavings: eur(699),
        insights: [
          {
            id: uuid(1),
            kind: 'unusual-spending',
            priority: 1,
            title: 'Más ocio',
            body: 'Gastaste más.',
            potentialMonthlySavings: eur(19_000),
            evidence: [{ label: 'Media', amount: eur(12_000) }],
            actions: [
              { type: 'set-budget', categoryId: 'leisure', month: '2026-10', limit: eur(12_000) },
            ],
          },
        ],
      }),
    ]);

    const report = await repository.insights('h');

    expect(report.totalPotentialMonthlySavings.amountMinor).toBe(699);
    expect(report.insights[0]?.actions[0]).toMatchObject({
      type: 'set-budget',
      month: { year: 2026, month: 10 },
    });
  });

  it('streams chat events until done, skipping events it does not know', async () => {
    const body = sse(
      { type: 'delta', text: 'Hola' },
      { type: 'something-new', value: 1 },
      {
        type: 'plan',
        plan: {
          id: uuid(2),
          kind: 'debt-payoff',
          title: 'Plan',
          summary: '',
          steps: [{ title: 'Paso', detail: '', action: null }],
          projection: {
            monthlySaving: null,
            interestSaved: eur(5_000),
            debtFreeDate: '2028-03-01',
          },
        },
      },
      { type: 'done', conversationId: uuid(3), messageId: uuid(4), remainingMessagesToday: 19 },
    );
    const post = jest.fn(async () => ({
      ok: true as const,
      body: streamOf(splitAt(body, 17, 90)),
    }));
    const { repository } = repositoryWith([], { post });

    const events = await collect(repository.chat('h', '¿Y la tarjeta?'));

    expect(events.map((event) => event.type)).toEqual(['delta', 'plan', 'done']);
    const plan = events[1] as Extract<ChatEvent, { type: 'plan' }>;
    expect(plan.plan.projection.debtFreeDate).toEqual(new Date(2028, 2, 1));
    expect(post).toHaveBeenCalledWith(
      '/v1/households/h/advisor/chat',
      { message: '¿Y la tarjeta?' },
      expect.any(AbortSignal),
    );
  });

  it('turns refusals to start (quota, consent) and cut streams into error events', async () => {
    const refused = repositoryWith([], {
      post: async () => ({
        ok: false,
        problem: { type: '/problems/advisor-quota-exceeded', detail: 'Vuelve mañana.' },
        offline: false,
      }),
    });
    expect(await collect(refused.repository.chat('h', 'Hola'))).toEqual([
      { type: 'error', message: 'Vuelve mañana.' },
    ]);

    const cut = repositoryWith([], {
      post: async () => ({ ok: true, body: streamOf(splitAt(sse({ type: 'delta', text: 'Ho' }))) }),
    });
    const events = await collect(cut.repository.chat('h', 'Hola'));
    expect(events.at(-1)).toMatchObject({ type: 'error' });
  });

  it('breaking out of the loop aborts the request', async () => {
    let signal: AbortSignal | undefined;
    const { repository } = repositoryWith([], {
      post: async (_path, _body, s) => {
        signal = s;
        return {
          ok: true,
          body: streamOf(splitAt(sse({ type: 'delta', text: 'a' }, { type: 'delta', text: 'b' }))),
        };
      },
    });

    for await (const event of repository.chat('h', 'Hola')) {
      expect(event.type).toBe('delta');
      break;
    }

    expect(signal?.aborted).toBe(true);
  });

  it('records applied actions with the contract shape', async () => {
    const { repository, request } = repositoryWith([
      ok(undefined),
      err({ kind: 'network', message: 'x' }),
    ]);

    await repository.recordApplied(
      'h',
      { type: 'cancel-recurring', recurringPaymentId: uuid(5) },
      { insightId: uuid(1) },
    );

    expect(request).toHaveBeenCalledWith(
      '/v1/households/h/advisor/applied',
      expect.objectContaining({
        body: {
          source: { insightId: uuid(1) },
          action: { type: 'cancel-recurring', recurringPaymentId: uuid(5) },
        },
      }),
    );
  });
});
