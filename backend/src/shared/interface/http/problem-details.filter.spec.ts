import { type ArgumentsHost, Logger, NotFoundException } from '@nestjs/common';

import { DomainError } from '../../domain/domain-error.js';
import { ProblemDetailsFilter } from './problem-details.filter.js';
import { RequestValidationError } from './request-validation.error.js';

class ThingAlreadyExistsError extends DomainError {
  readonly kind = 'conflict';
  readonly code = 'thing-already-exists';
  readonly title = 'Thing already exists';
}

function render(exception: unknown) {
  const sent = { status: 0, type: '', body: '' };
  const response = {
    status(code: number) {
      sent.status = code;
      return this;
    },
    type(value: string) {
      sent.type = value;
      return this;
    },
    send(body: string) {
      sent.body = body;
      return this;
    },
  };
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ originalUrl: '/v1/things/1', id: 'req-1' }),
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;

  new ProblemDetailsFilter().catch(exception, host);
  return { ...sent, problem: JSON.parse(sent.body) as Record<string, unknown> };
}

describe('ProblemDetailsFilter', () => {
  it('renders validation errors as 400 with the offending values', () => {
    const { status, type, problem } = render(
      new RequestValidationError([{ in: 'body', pointer: '#/text', detail: 'Required' }]),
    );

    expect(status).toBe(400);
    expect(type).toBe('application/problem+json');
    expect(problem).toMatchObject({
      type: '/problems/validation-error',
      status: 400,
      instance: '/v1/things/1',
      traceId: 'req-1',
      errors: [{ in: 'body', pointer: '#/text', detail: 'Required' }],
    });
  });

  it('maps domain errors by kind', () => {
    const { status, problem } = render(new ThingAlreadyExistsError('Thing 1 already exists'));

    expect(status).toBe(409);
    expect(problem).toMatchObject({
      type: '/problems/thing-already-exists',
      title: 'Thing already exists',
      detail: 'Thing 1 already exists',
    });
  });

  it('keeps the status of framework HTTP errors', () => {
    const { problem } = render(new NotFoundException('Cannot GET /nope'));

    expect(problem).toMatchObject({ type: 'about:blank', title: 'Not Found', status: 404 });
  });

  it('hides unexpected errors behind a generic 500 and logs them', () => {
    const log = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    const { problem } = render(new Error('connection string with password'));

    expect(problem).toMatchObject({ status: 500, detail: 'An unexpected error occurred.' });
    expect(JSON.stringify(problem)).not.toContain('password');
    expect(log).toHaveBeenCalledOnce();
    log.mockRestore();
  });
});
