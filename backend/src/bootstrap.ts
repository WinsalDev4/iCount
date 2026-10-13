import type { INestApplication } from '@nestjs/common';
import { API_VERSION } from '@icount/contracts';
import { Logger } from 'nestjs-pino';

import { setupOpenApi } from './shared/interface/http/openapi.js';

export const API_PREFIX = `v${API_VERSION}`;

/**
 * HTTP setup shared by `main.ts` and the e2e tests, so tests exercise the same
 * app that runs in production. Call before `init()`/`listen()`.
 */
export function configureApp(app: INestApplication): INestApplication {
  app.useLogger(app.get(Logger));
  app.setGlobalPrefix(API_PREFIX, { exclude: ['health'] });
  app.enableShutdownHooks();
  setupOpenApi(app);
  return app;
}
