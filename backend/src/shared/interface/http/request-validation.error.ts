import type { ValidationErrorItem } from './problem-details.js';

/** Thrown by ZodValidationPipe; rendered as a 400 problem with an `errors` list. */
export class RequestValidationError extends Error {
  constructor(readonly errors: readonly ValidationErrorItem[]) {
    super(`Request validation failed (${errors.length} error(s))`);
    this.name = 'RequestValidationError';
  }
}
