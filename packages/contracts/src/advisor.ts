import { z } from 'zod';

import { categoryRefSchema } from './category.ts';
import { debtIdSchema, recurringPaymentIdSchema } from './ids.ts';
import { moneyDtoSchema } from './money.ts';
import { problemDetailsSchema } from './problemDetails.ts';
import { localDateSchema, positiveMoneySchema, yearMonthSchema } from './transaction.ts';

/**
 * AI advisor (ADR-0020). Every number in these DTOs is computed by deterministic
 * code (@icount/finance, SQL aggregates); the model only chooses, ranks and words.
 */

/** Something the app can apply with one tap, reusing its existing use cases. */
export const advisorActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('set-budget'),
    categoryId: categoryRefSchema,
    month: yearMonthSchema,
    limit: positiveMoneySchema,
  }),
  z.object({
    type: z.literal('extra-debt-payment'),
    debtId: debtIdSchema,
    extraMonthly: positiveMoneySchema,
  }),
  z.object({
    type: z.literal('cancel-recurring'),
    recurringPaymentId: recurringPaymentIdSchema,
  }),
]);

export const INSIGHT_KINDS = [
  'duplicate-subscription',
  'budget-exceeded',
  'expensive-debt',
  'unusual-spending',
] as const;

/** Tolerant reader: insight kinds added later show as generic cards in older apps. */
export const insightKindResponseSchema = z.enum([...INSIGHT_KINDS, 'other']).catch('other');

/** A figure that backs an insight, always taken from the data (never generated). */
export const evidenceSchema = z.object({
  label: z.string().min(1).max(60),
  amount: moneyDtoSchema,
});

export const insightDtoSchema = z.object({
  id: z.uuid(),
  kind: insightKindResponseSchema,
  /** 1 = most important. */
  priority: z.int().min(1).max(5),
  title: z.string().min(1).max(80),
  body: z.string().min(1).max(400),
  potentialMonthlySavings: moneyDtoSchema.nullable(),
  evidence: z.array(evidenceSchema).max(5),
  actions: z.array(advisorActionSchema).max(3),
});

/** GET /v1/households/:id/advisor/insights */
export const insightsReportDtoSchema = z.object({
  generatedAt: z.iso.datetime(),
  totalPotentialMonthlySavings: moneyDtoSchema,
  insights: z.array(insightDtoSchema),
});

export const planStepSchema = z.object({
  title: z.string().min(1).max(80),
  detail: z.string().max(300),
  action: advisorActionSchema.nullable(),
});

/** A savings or debt-payoff plan; the projection comes from @icount/finance. */
export const planDtoSchema = z.object({
  id: z.uuid(),
  kind: z.enum(['savings', 'debt-payoff']),
  title: z.string().min(1).max(80),
  summary: z.string().max(400),
  steps: z.array(planStepSchema).min(1).max(6),
  projection: z.object({
    monthlySaving: moneyDtoSchema.nullable(),
    interestSaved: moneyDtoSchema.nullable(),
    debtFreeDate: localDateSchema.nullable(),
  }),
});

/** POST /v1/households/:id/advisor/chat (SSE response; see chatStreamEventSchema). */
export const chatRequestSchema = z.object({
  /** Omit to start a new conversation. */
  conversationId: z.uuid().optional(),
  message: z.string().trim().min(1).max(2_000),
});

/**
 * One Server-Sent Event of the chat stream, sent as `data: <json>\n\n`.
 * `delta` events concatenate into the answer; `plan` attaches a plan card;
 * the stream ends with exactly one `done` or `error`.
 */
export const chatStreamEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('delta'), text: z.string() }),
  z.object({ type: z.literal('plan'), plan: planDtoSchema }),
  z.object({
    type: z.literal('done'),
    conversationId: z.uuid(),
    messageId: z.uuid(),
    /** Messages left today for this user (cost quota). */
    remainingMessagesToday: z.int().min(0),
  }),
  z.object({ type: z.literal('error'), problem: problemDetailsSchema }),
]);

export const chatMessageDtoSchema = z.object({
  id: z.uuid(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  plan: planDtoSchema.nullable(),
  createdAt: z.iso.datetime(),
});

/** GET / PUT /v1/me/advisor/consent — nothing is sent to the model without it. */
export const advisorConsentDtoSchema = z.object({
  granted: z.boolean(),
  /** Version of the consent text the user accepted; a new version asks again. */
  version: z.int().min(1),
  grantedAt: z.iso.datetime().nullable(),
});

export const setAdvisorConsentRequestSchema = z.object({
  granted: z.boolean(),
  version: z.int().min(1),
});

/** POST /v1/households/:id/advisor/applied → 204. Records what the user applied (evaluation). */
export const appliedActionRequestSchema = z.object({
  source: z.object({
    insightId: z.uuid().optional(),
    planId: z.uuid().optional(),
  }),
  action: advisorActionSchema,
});

export type AdvisorAction = z.infer<typeof advisorActionSchema>;
export type InsightKind = (typeof INSIGHT_KINDS)[number];
export type InsightDto = z.infer<typeof insightDtoSchema>;
export type InsightsReportDto = z.infer<typeof insightsReportDtoSchema>;
export type PlanDto = z.infer<typeof planDtoSchema>;
export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type ChatStreamEvent = z.infer<typeof chatStreamEventSchema>;
export type ChatMessageDto = z.infer<typeof chatMessageDtoSchema>;
export type AdvisorConsentDto = z.infer<typeof advisorConsentDtoSchema>;
export type SetAdvisorConsentRequest = z.infer<typeof setAdvisorConsentRequestSchema>;
export type AppliedActionRequest = z.infer<typeof appliedActionRequestSchema>;
