import { describe, expect, it } from 'vitest';

import { problemDetailsSchema } from '../index.ts';

describe('problemDetailsSchema', () => {
  it('parses an iCount validation problem', () => {
    const problem = {
      type: '/problems/validation-error',
      title: 'Invalid request',
      status: 400,
      detail: 'The request has 1 invalid value(s).',
      instance: '/v1/notes',
      traceId: 'c20eec77',
      errors: [{ in: 'body', pointer: '#/text', detail: 'Required' }],
    };

    expect(problemDetailsSchema.parse(problem)).toEqual(problem);
  });

  it('defaults type to about:blank and keeps unknown extensions', () => {
    expect(problemDetailsSchema.parse({ status: 502, retryAfter: 30 })).toEqual({
      type: 'about:blank',
      status: 502,
      retryAfter: 30,
    });
  });

  it.each([
    ['a non-numeric status', { status: '404' }],
    ['an out of range status', { status: 99 }],
    ['malformed validation errors', { errors: [{ pointer: '#/a' }] }],
    ['an unknown error location', { errors: [{ in: 'header', pointer: '#/a', detail: 'x' }] }],
  ])('rejects %s', (_, problem) => {
    expect(problemDetailsSchema.safeParse(problem).success).toBe(false);
  });
});
