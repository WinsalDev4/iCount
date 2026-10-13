import {
  PROBLEM_JSON,
  problemDetailsSchema as contractProblemDetailsSchema,
  type ValidationError,
} from '@icount/contracts';
import { z } from 'zod';

/**
 * RFC 9457 "Problem Details for HTTP APIs", from the shared contract.
 * The contract is lenient (clients must tolerate any problem); this API always
 * emits `type`, `title` and `status`, so they are required here (and in OpenAPI).
 */
export const problemDetailsSchema = z.object(contractProblemDetailsSchema.shape).extend({
  type: z.string(),
  title: z.string(),
  status: z.int().min(100).max(599),
});

export type ProblemDetails = z.infer<typeof problemDetailsSchema>;
export type ValidationErrorItem = ValidationError;
export { PROBLEM_JSON };

/** Relative URI reference for problem types defined by this API. */
export const problemType = (code: string): string => `/problems/${code}`;
