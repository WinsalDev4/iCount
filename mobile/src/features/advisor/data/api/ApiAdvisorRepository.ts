import {
  advisorConsentDtoSchema,
  chatStreamEventSchema,
  insightsReportDtoSchema,
} from '@icount/contracts';
import { z } from 'zod';

import { describeHttpError } from '@/core/network/HttpError';
import type { HttpClient, RequestOptions } from '@/core/network/httpClient';

import type {
  AdvisorAction,
  AdvisorConsent,
  ChatEvent,
  InsightsReport,
} from '../../domain/Advisor';
import type { AdvisorRepository } from '../../domain/AdvisorRepository';
import { problemMessage, toActionDto, toChatEvent, toInsightsReport } from './advisorMapper';
import { type EventStreamClient, sseData } from './eventStream';

/**
 * AdvisorRepository over the API (ADR-0020). The app never talks to the model:
 * JSON endpoints go through the authenticated HttpClient, and the chat is a
 * Server-Sent Events stream read as an AsyncIterable (Kotlin analogy: a cold
 * `Flow` you collect; iOS: an `AsyncThrowingStream`).
 */
export class ApiAdvisorRepository implements AdvisorRepository {
  constructor(
    private readonly http: HttpClient,
    private readonly events: EventStreamClient,
  ) {}

  async getConsent(): Promise<AdvisorConsent> {
    const consent = await this.call('/v1/me/advisor/consent', { schema: advisorConsentDtoSchema });
    return { granted: consent.granted, version: consent.version };
  }

  async setConsent(consent: AdvisorConsent): Promise<AdvisorConsent> {
    const saved = await this.call('/v1/me/advisor/consent', {
      method: 'PUT',
      body: { granted: consent.granted, version: consent.version },
      schema: advisorConsentDtoSchema,
    });
    return { granted: saved.granted, version: saved.version };
  }

  async insights(householdId: string): Promise<InsightsReport> {
    return toInsightsReport(
      await this.call(`/v1/households/${householdId}/advisor/insights`, {
        schema: insightsReportDtoSchema,
      }),
    );
  }

  /**
   * Yields events until `done` or `error`. Errors are events, never thrown, so
   * the screen shows them in the conversation. Breaking out of the loop aborts
   * the request (and the server stops the model).
   */
  async *chat(
    householdId: string,
    message: string,
    conversationId?: string,
  ): AsyncGenerator<ChatEvent> {
    const abort = new AbortController();
    try {
      const opened = await this.events.post(
        `/v1/households/${householdId}/advisor/chat`,
        { message, ...(conversationId ? { conversationId } : {}) },
        abort.signal,
      );
      if (!opened.ok) {
        yield {
          type: 'error',
          message: opened.offline
            ? 'Sin conexión. Inténtalo de nuevo.'
            : problemMessage(opened.problem),
        };
        return;
      }
      for await (const data of sseData(opened.body)) {
        const parsed = chatStreamEventSchema.safeParse(safeJson(data));
        if (!parsed.success) continue; // tolerant reader: skip what this version does not know
        const event = toChatEvent(parsed.data);
        yield event;
        if (event.type === 'done' || event.type === 'error') return;
      }
      yield { type: 'error', message: 'La respuesta se cortó. Inténtalo de nuevo.' };
    } catch {
      if (!abort.signal.aborted) {
        yield { type: 'error', message: 'Se perdió la conexión con el asistente.' };
      }
    } finally {
      abort.abort();
    }
  }

  async recordApplied(
    householdId: string,
    action: AdvisorAction,
    source: { insightId?: string; planId?: string },
  ): Promise<void> {
    await this.call(`/v1/households/${householdId}/advisor/applied`, {
      method: 'POST',
      body: { source, action: toActionDto(action) },
      schema: z.undefined(),
    });
  }

  private async call<S extends z.ZodType>(path: string, options: RequestOptions<S>) {
    const result = await this.http.request(path, options);
    if (!result.ok) throw new Error(describeHttpError(result.error));
    return result.value;
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
