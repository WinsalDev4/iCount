import { randomUUID } from 'node:crypto';

import type { DynamicModule } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

import type { AppConfig } from '../config/app-config.js';

export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Structured JSON logs (pino): one line per event, with the request id on every
 * line of a request. Human-readable output only in development.
 * Spring analogy: Logback with a JSON encoder + MDC for the trace id.
 */
export function createLoggerModule(config: AppConfig): DynamicModule {
  return LoggerModule.forRoot({
    pinoHttp: {
      level: config.logLevel,
      genReqId: (req, res) => {
        const incoming = req.headers[REQUEST_ID_HEADER];
        const id = typeof incoming === 'string' && incoming !== '' ? incoming : randomUUID();
        res.setHeader(REQUEST_ID_HEADER, id);
        return id;
      },
      customLogLevel: (_req, res, error) => {
        if (error || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
      redact: ['req.headers.authorization', 'req.headers.cookie'],
      ...(config.nodeEnv === 'development'
        ? { transport: { target: 'pino-pretty', options: { singleLine: true } } }
        : {}),
    },
  });
}
