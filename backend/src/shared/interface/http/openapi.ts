import { applyDecorators, type INestApplication } from '@nestjs/common';
import { ApiResponse, DocumentBuilder, type SchemaObject, SwaggerModule } from '@nestjs/swagger';
import { API_VERSION } from '@icount/contracts';
import { z } from 'zod';

import { PROBLEM_JSON, problemDetailsSchema } from './problem-details.js';

export const OPENAPI_PATH = 'docs';

/**
 * zod schema → OpenAPI schema, so request/response docs come from the same
 * schemas that validate at runtime (no duplicated DTO classes).
 */
export function zodToOpenApi(schema: z.ZodType, io: 'input' | 'output' = 'output'): SchemaObject {
  return z.toJSONSchema(schema, { target: 'openapi-3.0', io }) as SchemaObject;
}

const PROBLEM_DESCRIPTIONS: Record<number, string> = {
  400: 'Invalid request (see `errors`)',
  404: 'Resource not found',
  409: 'Conflict with the current state',
  422: 'Business rule violated',
};

/** Documents error responses as `application/problem+json` (RFC 9457). */
export function ApiProblemResponses(...statuses: number[]) {
  return applyDecorators(
    ...statuses.map((status) =>
      ApiResponse({
        status,
        description: PROBLEM_DESCRIPTIONS[status] ?? 'Error',
        content: {
          [PROBLEM_JSON]: { schema: { $ref: '#/components/schemas/ProblemDetails' } },
        },
      }),
    ),
  );
}

/** Serves Swagger UI at `/docs` and the raw document at `/docs/json`. */
export function setupOpenApi(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('iCount API')
    .setDescription('Finanzas personales y economías compartidas. Errores en RFC 9457.')
    .setVersion(String(API_VERSION))
    .build();

  const document = SwaggerModule.createDocument(app, config);
  document.components = {
    ...document.components,
    schemas: {
      ...document.components?.schemas,
      ProblemDetails: zodToOpenApi(problemDetailsSchema),
    },
  };

  SwaggerModule.setup(OPENAPI_PATH, app, document, { jsonDocumentUrl: `${OPENAPI_PATH}/json` });
}
