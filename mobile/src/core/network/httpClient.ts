import { problemDetailsSchema, type ProblemDetails } from '@icount/contracts';
import { z } from 'zod';

import { err, ok, type Result } from '@/core/domain/Result';

import { ApiError, type HttpError } from './HttpError';

export const DEFAULT_TIMEOUT_MS = 15_000;

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type QueryValue = string | number | boolean | undefined;

export interface HttpClientConfig {
  /** e.g. `http://10.0.2.2:3000`, from `env.apiUrl`. */
  readonly baseUrl: string;
  readonly timeoutMs?: number;
  /** Injected for tests; defaults to the global fetch (expo/fetch on native). */
  readonly fetch?: typeof fetch;
  /** Extra headers per request (the auth token arrives in phase 2). */
  readonly headers?: () => Record<string, string> | Promise<Record<string, string>>;
}

export interface RequestOptions<S extends z.ZodType> {
  /** Contract the 2xx body must satisfy, usually from @icount/contracts. */
  readonly schema: S;
  readonly method?: HttpMethod;
  readonly query?: Readonly<Record<string, QueryValue>>;
  readonly body?: unknown;
  readonly headers?: Readonly<Record<string, string>>;
  /** Caller cancellation, e.g. the `signal` TanStack Query passes to `queryFn`. */
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
}

export interface HttpClient {
  request<S extends z.ZodType>(
    path: string,
    options: RequestOptions<S>,
  ): Promise<Result<z.output<S>, HttpError>>;
}

/**
 * Thin typed HTTP client over `fetch`. Never throws: every outcome is a Result.
 * Android analogy: Retrofit + OkHttp (timeouts) + a converter that validates
 * the JSON; iOS: URLSession + JSONDecoder.
 */
export function createHttpClient(config: HttpClientConfig): HttpClient {
  const fetchFn = config.fetch ?? ((input, init) => fetch(input, init));
  const baseUrl = config.baseUrl.replace(/\/+$/, '');

  return {
    async request(path, options) {
      const timeoutMs = options.timeoutMs ?? config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
      const abort = linkAbort(options.signal, timeoutMs);
      try {
        const extraHeaders = (await config.headers?.()) ?? {};
        const hasBody = options.body !== undefined;
        const response = await fetchFn(baseUrl + path + toQueryString(options.query), {
          method: options.method ?? 'GET',
          headers: {
            Accept: 'application/json, application/problem+json',
            ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
            ...extraHeaders,
            ...options.headers,
          },
          body: hasBody ? JSON.stringify(options.body) : undefined,
          signal: abort.signal,
        });
        const text = await response.text();

        if (!response.ok) {
          return err({ kind: 'http', status: response.status, problem: toProblem(response, text) });
        }
        return parseBody(text, options.schema);
      } catch (error) {
        if (abort.timedOut()) return err({ kind: 'timeout', timeoutMs });
        if (options.signal?.aborted) return err({ kind: 'cancelled' });
        return err({
          kind: 'network',
          message: error instanceof Error ? error.message : String(error),
        });
      } finally {
        abort.dispose();
      }
    },
  };
}

/** For TanStack Query: turns a failed Result into a thrown ApiError. */
export function unwrap<T>(result: Result<T, HttpError>): T {
  if (result.ok) return result.value;
  throw new ApiError(result.error);
}

function parseBody<S extends z.ZodType>(text: string, schema: S): Result<z.output<S>, HttpError> {
  let json: unknown;
  try {
    json = text === '' ? undefined : JSON.parse(text);
  } catch {
    return err({ kind: 'validation', message: 'Response body is not valid JSON' });
  }
  const parsed = schema.safeParse(json);
  return parsed.success
    ? ok(parsed.data)
    : err({ kind: 'validation', message: z.prettifyError(parsed.error) });
}

/** Uses the server's problem+json when present; otherwise builds one from the status. */
function toProblem(response: Response, text: string): ProblemDetails {
  try {
    const parsed = problemDetailsSchema.safeParse(JSON.parse(text));
    if (parsed.success) return { ...parsed.data, status: parsed.data.status ?? response.status };
  } catch {
    // Not JSON (e.g. an HTML error page from a proxy): fall through.
  }
  return {
    type: 'about:blank',
    status: response.status,
    ...(response.statusText ? { title: response.statusText } : {}),
  };
}

function toQueryString(query: RequestOptions<z.ZodType>['query']): string {
  if (!query) return '';
  const pairs = Object.entries(query)
    .filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return pairs.length ? `?${pairs.join('&')}` : '';
}

/**
 * One AbortSignal for fetch that fires on timeout or when the caller aborts.
 * (Manual linking: `AbortSignal.any`/`timeout` are not guaranteed on Hermes.)
 */
function linkAbort(callerSignal: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onCallerAbort = () => controller.abort();

  if (callerSignal?.aborted) controller.abort();
  callerSignal?.addEventListener('abort', onCallerAbort);

  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    dispose: () => {
      clearTimeout(timer);
      callerSignal?.removeEventListener('abort', onCallerAbort);
    },
  };
}
