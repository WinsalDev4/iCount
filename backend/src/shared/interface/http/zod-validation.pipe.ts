import type { ArgumentMetadata, PipeTransform } from '@nestjs/common';
import type { z } from 'zod';

import type { ValidationErrorItem } from './problem-details.js';
import { RequestValidationError } from './request-validation.error.js';

const LOCATION: Partial<Record<ArgumentMetadata['type'], ValidationErrorItem['in']>> = {
  body: 'body',
  query: 'query',
  param: 'path',
};

/**
 * Validates and parses one handler argument with a zod schema, e.g.
 * `@Body(new ZodValidationPipe(createNoteRequestSchema)) body: CreateNoteRequest`.
 * Spring analogy: `@Valid @RequestBody` with Bean Validation, but the schema is
 * also the TypeScript type and the OpenAPI schema.
 */
export class ZodValidationPipe<T extends z.ZodType> implements PipeTransform<unknown, z.output<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown, metadata: ArgumentMetadata): z.output<T> {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;

    const location = LOCATION[metadata.type] ?? 'body';
    // A single named argument (`@Param('id')`) is reported under its name.
    const prefix = metadata.data ? [metadata.data] : [];
    throw new RequestValidationError(
      result.error.issues.map((issue) => ({
        in: location,
        pointer: toJsonPointer([...prefix, ...issue.path]),
        detail: issue.message,
      })),
    );
  }
}

function toJsonPointer(path: readonly PropertyKey[]): string {
  const escape = (segment: PropertyKey) =>
    String(segment).replaceAll('~', '~0').replaceAll('/', '~1');
  return `#/${path.map(escape).join('/')}`;
}
