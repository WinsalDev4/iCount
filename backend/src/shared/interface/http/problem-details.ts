import { z } from 'zod';

/**
 * RFC 9457 "Problem Details for HTTP APIs": every error response has this shape
 * and the `application/problem+json` media type.
 * TODO(1.9): replace with the shared schema from @icount/contracts (A-1.2).
 */
export const PROBLEM_JSON = 'application/problem+json';

export const validationErrorSchema = z.object({
  in: z.enum(['body', 'query', 'path']),
  /** JSON Pointer (RFC 6901) to the offending value, e.g. `#/text`. */
  pointer: z.string(),
  detail: z.string(),
});

export const problemDetailsSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  instance: z.string().optional(),
  traceId: z.string().optional(),
  errors: z.array(validationErrorSchema).optional(),
});

export type ValidationErrorItem = z.infer<typeof validationErrorSchema>;
export type ProblemDetails = z.infer<typeof problemDetailsSchema>;

/** Relative URI reference for problem types defined by this API. */
export const problemType = (code: string): string => `/problems/${code}`;
