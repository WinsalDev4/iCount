import { z } from 'zod';

/** Media type of every error response of the API. */
export const PROBLEM_JSON = 'application/problem+json';

/** One invalid value of a request (extension member `errors` of a 400 problem). */
export const validationErrorSchema = z.object({
  in: z.enum(['body', 'query', 'path']),
  /** JSON Pointer (RFC 6901) to the offending value, e.g. `#/amount/amountMinor`. */
  pointer: z.string(),
  detail: z.string(),
});

/**
 * RFC 9457 Problem Details. Loose on purpose: per the RFC, clients must ignore
 * extension members they do not know, and every standard member is optional
 * (`type` defaults to `about:blank`), so a proxy's error still parses.
 */
export const problemDetailsSchema = z.looseObject({
  type: z.string().default('about:blank'),
  title: z.string().optional(),
  status: z.int().min(100).max(599).optional(),
  detail: z.string().optional(),
  instance: z.string().optional(),
  /** iCount extension: request id to find the request in the server logs. */
  traceId: z.string().optional(),
  /** iCount extension: present on validation errors (400). */
  errors: z.array(validationErrorSchema).optional(),
});

export type ValidationError = z.infer<typeof validationErrorSchema>;
export type ProblemDetails = z.infer<typeof problemDetailsSchema>;
