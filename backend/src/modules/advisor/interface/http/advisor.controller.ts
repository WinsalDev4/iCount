import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, Res } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import {
  type AdvisorConsentDto,
  advisorConsentDtoSchema,
  type AppliedActionRequest,
  appliedActionRequestSchema,
  type ChatRequest,
  chatRequestSchema,
  type ChatStreamEvent,
  chatStreamEventSchema,
  type InsightsReportDto,
  insightsReportDtoSchema,
  type SetAdvisorConsentRequest,
  setAdvisorConsentRequestSchema,
} from '@icount/contracts';
import type { Response } from 'express';
import { z } from 'zod';

import type { AuthenticatedUser } from '../../../../shared/auth/authenticated-user.js';
import { CurrentUser } from '../../../../shared/auth/current-user.decorator.js';
import { DomainError } from '../../../../shared/domain/domain-error.js';
import { ApiProblemResponses, zodToOpenApi } from '../../../../shared/interface/http/openapi.js';
import { domainProblem } from '../../../../shared/interface/http/problem-details.filter.js';
import { ZodValidationPipe } from '../../../../shared/interface/http/zod-validation.pipe.js';
import {
  GetAdvisorConsent,
  RecordAppliedAction,
  SetAdvisorConsent,
  StartAdvisorChat,
} from '../../application/advisor.use-cases.js';
import { GetInsights } from '../../application/insights.use-cases.js';
import type { AdvisorConsent } from '../../domain/advisor.js';
import { fromActionDto, toInsightsReportDto, toPlanDto } from './advisor.mappers.js';

const uuidParam = new ZodValidationPipe(z.uuid());

@ApiTags('advisor')
@ApiBearerAuth()
@Controller()
export class AdvisorController {
  constructor(
    private readonly getConsent: GetAdvisorConsent,
    private readonly setConsent: SetAdvisorConsent,
    private readonly getInsights: GetInsights,
    private readonly startChat: StartAdvisorChat,
    private readonly recordApplied: RecordAppliedAction,
  ) {}

  @Get('me/advisor/consent')
  @ApiOkResponse({ schema: zodToOpenApi(advisorConsentDtoSchema) })
  @ApiProblemResponses(401)
  async consent(@CurrentUser() user: AuthenticatedUser): Promise<AdvisorConsentDto> {
    return toConsentDto(await this.getConsent.execute(user.userId));
  }

  @Put('me/advisor/consent')
  @ApiBody({ schema: zodToOpenApi(setAdvisorConsentRequestSchema, 'input') })
  @ApiOkResponse({ schema: zodToOpenApi(advisorConsentDtoSchema) })
  @ApiProblemResponses(400, 401, 422)
  async updateConsent(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(setAdvisorConsentRequestSchema)) body: SetAdvisorConsentRequest,
  ): Promise<AdvisorConsentDto> {
    return toConsentDto(await this.setConsent.execute(user.userId, body.granted, body.version));
  }

  @Get('households/:householdId/advisor/insights')
  @ApiOkResponse({ schema: zodToOpenApi(insightsReportDtoSchema) })
  @ApiProblemResponses(400, 401, 404)
  async insights(
    @CurrentUser() user: AuthenticatedUser,
    @Param('householdId', uuidParam) householdId: string,
  ): Promise<InsightsReportDto> {
    return toInsightsReportDto(await this.getInsights.execute(user.userId, householdId));
  }

  /**
   * Server-Sent Events: `data: <ChatStreamEvent>` lines, ending with one `done`
   * or `error`. Failures before the stream starts (consent, quota, no model)
   * are normal problem responses (403, 429, 503).
   */
  @Post('households/:householdId/advisor/chat')
  @ApiProduces('text/event-stream')
  @ApiBody({ schema: zodToOpenApi(chatRequestSchema, 'input') })
  @ApiOkResponse({ description: 'SSE stream of chatStreamEventSchema events' })
  @ApiProblemResponses(400, 401, 403, 404, 429, 503)
  async chat(
    @CurrentUser() user: AuthenticatedUser,
    @Param('householdId', uuidParam) householdId: string,
    @Body(new ZodValidationPipe(chatRequestSchema)) body: ChatRequest,
    @Res() res: Response,
  ): Promise<void> {
    const session = await this.startChat.start(
      user.userId,
      householdId,
      body.message,
      body.conversationId,
    );

    res.status(HttpStatus.OK).set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Proxies such as nginx must not buffer the stream.
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();

    // The app closing the connection (screen left, request cancelled) stops the model.
    const abort = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) abort.abort();
    });
    const send = (event: ChatStreamEvent) => {
      if (!res.writableEnded)
        res.write(`data: ${JSON.stringify(chatStreamEventSchema.parse(event))}\n\n`);
    };

    try {
      const done = await session.stream(
        {
          text: (text) => send({ type: 'delta', text }),
          plan: (plan) => send({ type: 'plan', plan: toPlanDto(plan) }),
        },
        abort.signal,
      );
      send({ type: 'done', ...done });
    } catch (error) {
      if (!abort.signal.aborted) {
        send({
          type: 'error',
          problem:
            error instanceof DomainError
              ? domainProblem(error)
              : { type: 'about:blank', title: 'Internal Server Error', status: 500 },
        });
      }
    } finally {
      res.end();
    }
  }

  @Post('households/:householdId/advisor/applied')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBody({ schema: zodToOpenApi(appliedActionRequestSchema, 'input') })
  @ApiNoContentResponse({ description: 'Recorded' })
  @ApiProblemResponses(400, 401, 404)
  async applied(
    @CurrentUser() user: AuthenticatedUser,
    @Param('householdId', uuidParam) householdId: string,
    @Body(new ZodValidationPipe(appliedActionRequestSchema)) body: AppliedActionRequest,
  ): Promise<void> {
    await this.recordApplied.execute(
      user.userId,
      householdId,
      fromActionDto(body.action),
      body.source,
    );
  }
}

function toConsentDto(consent: AdvisorConsent): AdvisorConsentDto {
  return advisorConsentDtoSchema.parse({
    granted: consent.granted,
    version: consent.version,
    grantedAt: consent.grantedAt?.toISOString() ?? null,
  });
}
