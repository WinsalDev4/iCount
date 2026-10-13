import { QueryClient } from '@tanstack/react-query';

import { ApiError, isRetryable } from '@/core/network/HttpError';

/** Retries after the first failure (3 attempts in total). */
export const MAX_QUERY_RETRIES = 2;
/** Data younger than this is served from cache without refetching. */
export const QUERY_STALE_TIME_MS = 30_000;

/**
 * Retry only transient API failures (network, timeout, 5xx). A 4xx, a contract
 * violation or a programming error would fail the same way again.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  return (
    failureCount < MAX_QUERY_RETRIES && error instanceof ApiError && isRetryable(error.details)
  );
}

/** Exponential backoff: 1 s, 2 s, 4 s… capped at 10 s. */
export function queryRetryDelay(attemptIndex: number): number {
  return Math.min(1_000 * 2 ** attemptIndex, 10_000);
}

/**
 * Single QueryClient for the app (server-state cache, ADR-0006).
 * Mutations never retry automatically: a POST that timed out may have been applied.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: QUERY_STALE_TIME_MS,
        retry: shouldRetryQuery,
        retryDelay: queryRetryDelay,
      },
      mutations: { retry: false },
    },
  });
}
