import { z } from 'zod';

/**
 * Major version of the HTTP contract shared by the API and the app.
 * Breaking changes bump it; additive changes do not (see A-1.2 / docs/architecture/contratos.md).
 */
export const API_VERSION = 1;

export const apiVersionSchema = z.literal(API_VERSION);

export type ApiVersion = z.infer<typeof apiVersionSchema>;
