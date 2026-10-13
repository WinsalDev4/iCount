import type { ProblemDetails } from '@icount/contracts';

/**
 * Every way an API call can fail, as data (a discriminated union, like a Kotlin
 * sealed class). Each kind tells the UI something different:
 * - `network`: no connection / DNS / TLS → "check your connection", retry.
 * - `timeout`: the server did not answer in time → retry.
 * - `cancelled`: the caller aborted (e.g. the screen unmounted) → ignore.
 * - `http`: the server answered with an error status; `problem` is RFC 9457.
 * - `validation`: the server answered 2xx but the body breaks the contract → bug, report it.
 */
export type HttpError =
  | { readonly kind: 'network'; readonly message: string }
  | { readonly kind: 'timeout'; readonly timeoutMs: number }
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'http'; readonly status: number; readonly problem: ProblemDetails }
  | { readonly kind: 'validation'; readonly message: string };

/** Only transient failures are worth retrying; 4xx would fail the same way again. */
export function isRetryable(error: HttpError): boolean {
  switch (error.kind) {
    case 'network':
    case 'timeout':
      return true;
    case 'http':
      return error.status >= 500;
    case 'cancelled':
    case 'validation':
      return false;
  }
}

export function describeHttpError(error: HttpError): string {
  switch (error.kind) {
    case 'network':
      return `Network error: ${error.message}`;
    case 'timeout':
      return `Request timed out after ${error.timeoutMs} ms`;
    case 'cancelled':
      return 'Request cancelled';
    case 'http':
      return `HTTP ${error.status}: ${error.problem.detail ?? error.problem.title ?? 'Error'}`;
    case 'validation':
      return `Unexpected response: ${error.message}`;
  }
}

/**
 * Throwable wrapper for the places that need exceptions (TanStack Query's
 * `queryFn` rejects to signal failure). Keeps the typed `HttpError` inside.
 */
export class ApiError extends Error {
  constructor(readonly details: HttpError) {
    super(describeHttpError(details));
    this.name = 'ApiError';
  }
}
