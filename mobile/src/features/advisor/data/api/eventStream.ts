import { type ProblemDetails, problemDetailsSchema } from '@icount/contracts';

import type { Authenticator } from '@/core/network/withAuthentication';

const LF = 0x0a;
const CR = 0x0d;

/**
 * Reads a Server-Sent Events body and yields the `data` of each event
 * (several `data:` lines are joined with "\n"; comments and other fields are
 * ignored). Events are split on raw bytes and decoded whole, so a UTF-8
 * character cut between two network chunks is never decoded in halves (the
 * native TextDecoder of Expo does not support streaming decode).
 */
export async function* sseData(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer: Uint8Array = new Uint8Array(0);
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (value) buffer = concat(buffer, value);
      let end: number;
      while ((end = eventEnd(buffer)) >= 0) {
        const data = dataOf(decoder.decode(buffer.subarray(0, end)));
        buffer = buffer.subarray(end);
        if (data !== null) yield data;
      }
      if (done) break;
    }
    const rest = buffer.length > 0 ? dataOf(decoder.decode(buffer)) : null;
    if (rest !== null) yield rest;
  } finally {
    reader.releaseLock();
  }
}

/** Index just past the blank line that ends the first complete event, or -1. */
function eventEnd(bytes: Uint8Array): number {
  for (let i = 0; i < bytes.length - 1; i += 1) {
    if (bytes[i] === LF && bytes[i + 1] === LF) return i + 2;
    if (bytes[i] === LF && bytes[i + 1] === CR && bytes[i + 2] === LF) return i + 3;
  }
  return -1;
}

function dataOf(event: string): string | null {
  const lines = event
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(line.startsWith('data: ') ? 6 : 5));
  return lines.length > 0 ? lines.join('\n') : null;
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const joined = new Uint8Array(a.length + b.length);
  joined.set(a);
  joined.set(b, a.length);
  return joined;
}

export type EventStreamResult =
  | { readonly ok: true; readonly body: ReadableStream<Uint8Array> }
  | { readonly ok: false; readonly problem: ProblemDetails | null; readonly offline: boolean };

export interface EventStreamClient {
  /** POSTs JSON and returns the streaming body of a 2xx `text/event-stream` answer. */
  post(path: string, body: unknown, signal: AbortSignal): Promise<EventStreamResult>;
}

/**
 * The streaming twin of the authenticated HttpClient: same base URL, same
 * Bearer token and the same one-time refresh on a 401 (like OkHttp's
 * Authenticator). Uses expo/fetch, the global fetch on native, which exposes
 * `response.body` as a ReadableStream.
 */
export function createEventStreamClient(config: {
  readonly baseUrl: string;
  readonly auth: Authenticator;
  readonly fetch?: typeof fetch;
}): EventStreamClient {
  const fetchFn = config.fetch ?? ((input, init) => fetch(input, init));
  const baseUrl = config.baseUrl.replace(/\/+$/, '');

  const open = (path: string, body: unknown, token: string, signal: AbortSignal) =>
    fetchFn(baseUrl + path, {
      method: 'POST',
      headers: {
        Accept: 'text/event-stream, application/problem+json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      signal,
    });

  return {
    async post(path, body, signal) {
      try {
        const token = await config.auth.accessToken();
        if (!token)
          return { ok: false, problem: { type: 'about:blank', status: 401 }, offline: false };
        let response = await open(path, body, token, signal);
        if (response.status === 401) {
          const renewed = await config.auth.refresh(token);
          if (renewed) response = await open(path, body, renewed, signal);
        }
        if (response.ok && response.body) return { ok: true, body: response.body };
        return { ok: false, problem: await problemOf(response), offline: false };
      } catch {
        return { ok: false, problem: null, offline: !signal.aborted };
      }
    },
  };
}

async function problemOf(response: Response): Promise<ProblemDetails> {
  try {
    const parsed = problemDetailsSchema.safeParse(JSON.parse(await response.text()));
    if (parsed.success) return { ...parsed.data, status: parsed.data.status ?? response.status };
  } catch {
    // Not JSON: use the status alone.
  }
  return { type: 'about:blank', status: response.status };
}
