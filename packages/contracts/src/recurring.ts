import { z } from 'zod';

import { categoryRefResponseSchema, categoryRefSchema } from './category.ts';
import { debtIdSchema, householdIdSchema, recurringPaymentIdSchema, userIdSchema } from './ids.ts';
import { localDateSchema, positiveMoneySchema, transactionTypeSchema } from './transaction.ts';

/**
 * When a recurring payment falls due:
 * - `{ unit: 'month', interval: 1, dayOfMonth: 5 }` → the 5th of every month.
 * - `{ unit: 'month', interval: 3, dayOfMonth: 31 }` → every 3 months, on the last
 *   day when the month is shorter (31 → 30 or 28/29).
 * - `{ unit: 'year', interval: 1, dayOfMonth: 15, monthOfYear: 6 }` → every 15 June.
 */
export const recurrenceRuleSchema = z
  .object({
    unit: z.enum(['month', 'year']),
    interval: z.int().min(1).max(24),
    dayOfMonth: z.int().min(1).max(31),
    monthOfYear: z.int().min(1).max(12).optional(),
  })
  .refine((rule) => (rule.unit === 'year') === (rule.monthOfYear !== undefined), {
    message: 'monthOfYear is required for yearly rules and only for them',
    path: ['monthOfYear'],
  });

export const recurringKindSchema = z.enum(['bill', 'loan', 'subscription', 'income', 'other']);

export const recurringPaymentDtoSchema = z.object({
  id: recurringPaymentIdSchema,
  householdId: householdIdSchema,
  name: z.string().min(1).max(60),
  kind: recurringKindSchema,
  type: transactionTypeSchema,
  amount: positiveMoneySchema,
  categoryId: categoryRefResponseSchema,
  rule: recurrenceRuleSchema,
  startDate: localDateSchema,
  /** Null = open-ended. */
  endDate: localDateSchema.nullable(),
  /** Null when there are no more occurrences. */
  nextDueDate: localDateSchema.nullable(),
  payerId: userIdSchema,
  shared: z.boolean(),
  /** Set for loan instalments linked to a debt. */
  debtId: debtIdSchema.nullable(),
  createdAt: z.iso.datetime(),
});

/** POST /v1/households/:id/recurring → RecurringPaymentDto. */
export const createRecurringPaymentRequestSchema = z.object({
  name: z.string().trim().min(1).max(60),
  kind: recurringKindSchema,
  type: transactionTypeSchema,
  amount: positiveMoneySchema,
  categoryId: categoryRefSchema,
  rule: recurrenceRuleSchema,
  startDate: localDateSchema,
  endDate: localDateSchema.optional(),
  payerId: userIdSchema.optional(),
  shared: z.boolean().default(false),
  debtId: debtIdSchema.optional(),
});

/** PATCH /v1/recurring/:id → RecurringPaymentDto. No defaults. */
export const updateRecurringPaymentRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    kind: recurringKindSchema,
    amount: positiveMoneySchema,
    categoryId: categoryRefSchema,
    rule: recurrenceRuleSchema,
    endDate: localDateSchema.nullable(),
    payerId: userIdSchema,
    shared: z.boolean(),
  })
  .partial()
  .refine((changes) => Object.keys(changes).length > 0, { message: 'Nothing to update' });

/** GET /v1/households/:id/recurring/upcoming?from=…&to=… */
export const upcomingDueQuerySchema = z
  .object({ from: localDateSchema, to: localDateSchema })
  .refine((range) => range.from <= range.to, { message: '`from` must not be after `to`' });

export const upcomingDueDtoSchema = z.object({
  recurringPaymentId: recurringPaymentIdSchema,
  name: z.string(),
  dueDate: localDateSchema,
  type: transactionTypeSchema,
  amount: positiveMoneySchema,
  categoryId: categoryRefResponseSchema,
});

export type RecurrenceRule = z.infer<typeof recurrenceRuleSchema>;
export type RecurringKind = z.infer<typeof recurringKindSchema>;
export type RecurringPaymentDto = z.infer<typeof recurringPaymentDtoSchema>;
export type CreateRecurringPaymentRequest = z.infer<typeof createRecurringPaymentRequestSchema>;
export type UpdateRecurringPaymentRequest = z.infer<typeof updateRecurringPaymentRequestSchema>;
export type UpcomingDueQuery = z.infer<typeof upcomingDueQuerySchema>;
export type UpcomingDueDto = z.infer<typeof upcomingDueDtoSchema>;
