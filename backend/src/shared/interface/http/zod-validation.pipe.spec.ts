import { z } from 'zod';

import { RequestValidationError } from './request-validation.error.js';
import { ZodValidationPipe } from './zod-validation.pipe.js';

const schema = z.object({ text: z.string().min(1), tags: z.array(z.string()).optional() });

function errorsOf(run: () => unknown) {
  try {
    run();
  } catch (error) {
    if (error instanceof RequestValidationError) return error.errors;
    throw error;
  }
  throw new Error('expected a RequestValidationError');
}

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(schema);

  it('returns the parsed value', () => {
    expect(pipe.transform({ text: 'hola' }, { type: 'body' })).toEqual({ text: 'hola' });
  });

  it('reports every issue with its location and JSON pointer', () => {
    const errors = errorsOf(() => pipe.transform({ text: '', tags: [1] }, { type: 'body' }));

    expect(errors.map((e) => [e.in, e.pointer])).toEqual([
      ['body', '#/text'],
      ['body', '#/tags/0'],
    ]);
  });

  it('prefixes named path parameters', () => {
    const idPipe = new ZodValidationPipe(z.uuid());

    const errors = errorsOf(() => idPipe.transform('nope', { type: 'param', data: 'id' }));

    expect(errors[0]).toMatchObject({ in: 'path', pointer: '#/id' });
  });
});
