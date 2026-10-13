import { moneyDtoSchema } from '@icount/contracts';
import { z } from 'zod';

import { ApiError } from '../HttpError';
import { createHttpClient, unwrap } from '../httpClient';

interface FakeResponse {
  status: number;
  body?: unknown;
  statusText?: string;
}

/** Minimal Response double: the client only uses ok, status, statusText and text(). */
function respond({ status, body, statusText = '' }: FakeResponse) {
  const text = body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    text: async () => text,
  } as unknown as Response;
}

function clientWith(fetchImpl: jest.Mock, timeoutMs = 1_000) {
  return createHttpClient({ baseUrl: 'http://api.test/', fetch: fetchImpl, timeoutMs });
}

/** A fetch that never answers but rejects when its signal aborts, like the real one. */
function hangingFetch() {
  return jest.fn(
    (_url: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        const abort = () => reject(new Error('Aborted'));
        if (init.signal?.aborted) abort();
        init.signal?.addEventListener('abort', abort);
      }),
  );
}

describe('httpClient', () => {
  it('builds the URL, sends JSON and validates the response with the contract', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(respond({ status: 201, body: { amountMinor: 1050, currency: 'EUR' } }));

    const result = await clientWith(fetchMock).request('/v1/things', {
      method: 'POST',
      query: { limit: 20, cursor: 'a b', skipped: undefined },
      body: { name: 'x' },
      schema: moneyDtoSchema,
    });

    expect(result).toEqual({ ok: true, value: { amountMinor: 1050, currency: 'EUR' } });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://api.test/v1/things?limit=20&cursor=a%20b');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"name":"x"}');
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' });
  });

  it('accepts empty bodies when the schema allows them (204)', async () => {
    const fetchMock = jest.fn().mockResolvedValue(respond({ status: 204 }));

    const result = await clientWith(fetchMock).request('/v1/x', {
      method: 'DELETE',
      schema: z.undefined(),
    });

    expect(result).toEqual({ ok: true, value: undefined });
  });

  it('returns the RFC 9457 problem on HTTP errors', async () => {
    const problem = {
      type: '/problems/validation-error',
      title: 'Invalid request',
      status: 400,
      errors: [{ in: 'body', pointer: '#/text', detail: 'Required' }],
    };
    const fetchMock = jest.fn().mockResolvedValue(respond({ status: 400, body: problem }));

    const result = await clientWith(fetchMock).request('/v1/x', { schema: z.unknown() });

    expect(result).toEqual({ ok: false, error: { kind: 'http', status: 400, problem } });
  });

  it('builds a problem when the error body is not problem+json', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(respond({ status: 502, statusText: 'Bad Gateway', body: '<html/>' }));

    const result = await clientWith(fetchMock).request('/v1/x', { schema: z.unknown() });

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'http',
        status: 502,
        problem: { type: 'about:blank', status: 502, title: 'Bad Gateway' },
      },
    });
  });

  it('reports contract violations in 2xx responses', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(respond({ status: 200, body: { amountMinor: 10.5, currency: 'EUR' } }));

    const result = await clientWith(fetchMock).request('/v1/x', { schema: moneyDtoSchema });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.kind).toBe('validation');
  });

  it('reports invalid JSON as a contract violation', async () => {
    const fetchMock = jest.fn().mockResolvedValue(respond({ status: 200, body: '{nope' }));

    const result = await clientWith(fetchMock).request('/v1/x', { schema: z.unknown() });

    expect(result).toEqual({
      ok: false,
      error: { kind: 'validation', message: 'Response body is not valid JSON' },
    });
  });

  it('maps fetch failures to network errors', async () => {
    const fetchMock = jest.fn().mockRejectedValue(new TypeError('Network request failed'));

    const result = await clientWith(fetchMock).request('/v1/x', { schema: z.unknown() });

    expect(result).toEqual({
      ok: false,
      error: { kind: 'network', message: 'Network request failed' },
    });
  });

  describe('aborting', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('times out slow requests', async () => {
      const pending = clientWith(hangingFetch(), 5_000).request('/v1/x', { schema: z.unknown() });

      jest.advanceTimersByTime(5_000);

      await expect(pending).resolves.toEqual({
        ok: false,
        error: { kind: 'timeout', timeoutMs: 5_000 },
      });
    });

    it('distinguishes a cancellation by the caller from a timeout', async () => {
      const controller = new AbortController();
      const pending = clientWith(hangingFetch()).request('/v1/x', {
        schema: z.unknown(),
        signal: controller.signal,
      });

      controller.abort();

      await expect(pending).resolves.toEqual({ ok: false, error: { kind: 'cancelled' } });
    });
  });

  it('adds headers from the config (e.g. auth) to every request', async () => {
    const fetchMock = jest.fn().mockResolvedValue(respond({ status: 200, body: {} }));
    const client = createHttpClient({
      baseUrl: 'http://api.test',
      fetch: fetchMock,
      headers: async () => ({ Authorization: 'Bearer t' }),
    });

    await client.request('/v1/x', { schema: z.unknown() });

    expect((fetchMock.mock.calls[0] as [string, RequestInit])[1].headers).toMatchObject({
      Authorization: 'Bearer t',
    });
  });
});

describe('unwrap', () => {
  it('returns the value or throws an ApiError that keeps the typed error', () => {
    expect(unwrap({ ok: true, value: 1 })).toBe(1);
    try {
      unwrap({ ok: false, error: { kind: 'timeout', timeoutMs: 10 } });
      throw new Error('expected unwrap to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).details).toEqual({ kind: 'timeout', timeoutMs: 10 });
    }
  });
});
