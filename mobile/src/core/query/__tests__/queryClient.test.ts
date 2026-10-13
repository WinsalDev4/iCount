import { ApiError } from '@/core/network/HttpError';

import {
  createQueryClient,
  MAX_QUERY_RETRIES,
  queryRetryDelay,
  QUERY_STALE_TIME_MS,
  shouldRetryQuery,
} from '../queryClient';

const problem = { type: 'about:blank' };

describe('shouldRetryQuery', () => {
  it.each([
    ['network errors', new ApiError({ kind: 'network', message: 'offline' })],
    ['timeouts', new ApiError({ kind: 'timeout', timeoutMs: 15_000 })],
    ['5xx', new ApiError({ kind: 'http', status: 503, problem })],
  ])('retries %s', (_, error) => {
    expect(shouldRetryQuery(0, error)).toBe(true);
  });

  it.each([
    ['4xx', new ApiError({ kind: 'http', status: 404, problem })],
    ['contract violations', new ApiError({ kind: 'validation', message: 'bad body' })],
    ['cancellations', new ApiError({ kind: 'cancelled' })],
    ['programming errors', new TypeError('x is undefined')],
  ])('does not retry %s', (_, error) => {
    expect(shouldRetryQuery(0, error)).toBe(false);
  });

  it('stops after the maximum number of retries', () => {
    const error = new ApiError({ kind: 'network', message: 'offline' });
    expect(shouldRetryQuery(MAX_QUERY_RETRIES - 1, error)).toBe(true);
    expect(shouldRetryQuery(MAX_QUERY_RETRIES, error)).toBe(false);
  });
});

describe('queryRetryDelay', () => {
  it('backs off exponentially up to 10 s', () => {
    expect([0, 1, 2, 3, 4, 5].map(queryRetryDelay)).toEqual([
      1_000, 2_000, 4_000, 8_000, 10_000, 10_000,
    ]);
  });
});

describe('createQueryClient', () => {
  it('applies the retry policy and stale time to queries, and never retries mutations', () => {
    const client = createQueryClient();
    const { queries, mutations } = client.getDefaultOptions();

    expect(queries?.staleTime).toBe(QUERY_STALE_TIME_MS);
    expect(queries?.retry).toBe(shouldRetryQuery);
    expect(mutations?.retry).toBe(false);
  });
});
