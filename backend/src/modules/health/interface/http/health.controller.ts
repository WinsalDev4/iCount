import { Controller, Get, HttpStatus, Logger, Res } from '@nestjs/common';
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';

import { zodToOpenApi } from '../../../../shared/interface/http/openapi.js';
import { CheckHealth } from '../../application/check-health.use-case.js';
import type { HealthReport } from '../../domain/health-report.js';

export const healthResponseSchema = z.object({
  status: z.enum(['ok', 'error']),
  checks: z.object({
    database: z.object({
      status: z.enum(['up', 'down']),
      latencyMs: z.number().int().optional(),
    }),
  }),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

/**
 * Liveness + readiness in one endpoint: 200 when the API can serve traffic,
 * 503 when a dependency is down (Spring analogy: Actuator's /health).
 * Not versioned: load balancers and uptime monitors call it directly.
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly checkHealth: CheckHealth) {}

  @Get()
  @ApiOkResponse({
    description: 'Every dependency is up',
    schema: zodToOpenApi(healthResponseSchema),
  })
  @ApiServiceUnavailableResponse({
    description: 'A dependency is down',
    schema: zodToOpenApi(healthResponseSchema),
  })
  async check(@Res({ passthrough: true }) response: Response): Promise<HealthResponse> {
    const report = await this.checkHealth.execute();
    if (report.status === 'error') {
      this.logger.warn({ checks: report.checks }, 'Health check failed');
      response.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return toResponse(report);
  }
}

/** Failure reasons stay in the logs: they may contain hosts or credentials. */
function toResponse({ status, checks }: HealthReport): HealthResponse {
  const { database } = checks;
  return {
    status,
    checks: {
      database:
        database.status === 'up'
          ? { status: 'up', latencyMs: database.latencyMs }
          : { status: 'down' },
    },
  };
}
