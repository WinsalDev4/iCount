/**
 * Business rule violations. The domain only says *what* went wrong (`kind`, `code`);
 * the HTTP layer decides the status code (see ProblemDetailsFilter).
 */
export type DomainErrorKind =
  | 'invalid'
  | 'not_found'
  | 'conflict'
  | 'forbidden'
  | 'unauthenticated'
  | 'rate_limited'
  /** A dependency is missing or down (e.g. the AI provider): try again later. */
  | 'unavailable';

export abstract class DomainError extends Error {
  abstract readonly kind: DomainErrorKind;
  /** Stable kebab-case identifier, also used as the problem `type` slug. */
  abstract readonly code: string;
  /** Short human summary that does not change between occurrences. */
  abstract readonly title: string;
}
