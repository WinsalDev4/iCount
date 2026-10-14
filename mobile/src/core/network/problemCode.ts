import type { HttpError } from './HttpError';

/**
 * The stable code of an API problem: `/problems/invalid-invite` → `invalid-invite`.
 * Null for transport errors and generic HTTP errors (`about:blank`).
 * Repositories map these codes to their feature's domain errors.
 */
export function problemCode(error: HttpError): string | null {
  if (error.kind !== 'http') return null;
  const match = /^\/problems\/([a-z0-9-]+)$/.exec(error.problem.type);
  return match?.[1] ?? null;
}

/** No answer from the server: offline, DNS, timeout. The UI shows "check your connection". */
export function isConnectivityError(error: HttpError): boolean {
  return error.kind === 'network' || error.kind === 'timeout';
}
