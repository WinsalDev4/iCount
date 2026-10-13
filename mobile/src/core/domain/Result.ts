/**
 * Outcome of an operation that can fail in an expected way, without throwing.
 * Kotlin analogy: a sealed `Result<T, E>` (Arrow's Either); Swift: `Result<Success, Failure>`.
 * The `ok` discriminant lets TypeScript narrow: `if (result.ok) result.value else result.error`.
 */
export type Result<T, E> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function mapResult<T, U, E>(result: Result<T, E>, transform: (value: T) => U): Result<U, E> {
  return result.ok ? ok(transform(result.value)) : result;
}
