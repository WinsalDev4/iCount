import { z } from 'zod';

import { categoryRefResponseSchema, categoryRefSchema } from './category.ts';
import { householdIdSchema, transactionIdSchema, userIdSchema } from './ids.ts';
import { moneyDtoSchema } from './money.ts';
import { pageRequestSchema, pageSchema } from './pagination.ts';

/**
 * Calendar date `YYYY-MM-DD` (no time, no zone). A movement happens *on a day*
 * for the household, so the calendar and daily totals never shift with time zones.
 */
export const localDateSchema = z.iso.date();
/** Calendar month `YYYY-MM`. */
export const yearMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Expected YYYY-MM');

export const transactionTypeSchema = z.enum(['income', 'expense']);

/** Amounts on movements are always positive; the sign comes from `type`. */
export const positiveMoneySchema = moneyDtoSchema.refine((money) => money.amountMinor > 0, {
  message: 'Amount must be greater than zero',
});

/** Part of a shared movement that corresponds to one member (computed by the API). */
export const memberShareAmountSchema = z.object({
  memberId: userIdSchema,
  amount: moneyDtoSchema,
});

export const transactionDtoSchema = z.object({
  id: transactionIdSchema,
  householdId: householdIdSchema,
  type: transactionTypeSchema,
  amount: positiveMoneySchema,
  categoryId: categoryRefResponseSchema,
  description: z.string().max(140),
  occurredOn: localDateSchema,
  /** Member who paid (expense) or received (income) the money. */
  payerId: userIdSchema,
  /** Shared movements are split between members with the household's SplitRule. */
  shared: z.boolean(),
  /** Empty when not shared. When shared, the amounts add up to `amount`. */
  shares: z.array(memberShareAmountSchema),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

/** POST /v1/households/:id/transactions → TransactionDto. */
export const createTransactionRequestSchema = z.object({
  /**
   * Optional client-generated id: lets an optimistic update keep the same id and
   * makes retries idempotent (a repeated create with the same id is not duplicated).
   */
  id: transactionIdSchema.optional(),
  type: transactionTypeSchema,
  amount: positiveMoneySchema,
  categoryId: categoryRefSchema,
  description: z.string().trim().max(140).default(''),
  occurredOn: localDateSchema,
  /** Defaults to the signed-in member. */
  payerId: userIdSchema.optional(),
  shared: z.boolean().default(false),
});

/**
 * PATCH /v1/transactions/:id → TransactionDto. Only the fields sent change, so
 * nothing here has a default (a default would silently overwrite stored values).
 */
export const updateTransactionRequestSchema = z
  .object({
    type: transactionTypeSchema,
    amount: positiveMoneySchema,
    categoryId: categoryRefSchema,
    description: z.string().trim().max(140),
    occurredOn: localDateSchema,
    payerId: userIdSchema,
    shared: z.boolean(),
  })
  .partial()
  .refine((changes) => Object.keys(changes).length > 0, { message: 'Nothing to update' });

/** Query string values are strings: `'true'`/`'false'` → boolean. */
const booleanQuerySchema = z.enum(['true', 'false']).transform((value) => value === 'true');

/** GET /v1/households/:id/transactions?… → TransactionPage. Newest first. */
export const listTransactionsQuerySchema = pageRequestSchema.extend({
  type: transactionTypeSchema.optional(),
  categoryId: categoryRefSchema.optional(),
  memberId: userIdSchema.optional(),
  shared: booleanQuerySchema.optional(),
  /** Inclusive range of `occurredOn`. */
  from: localDateSchema.optional(),
  to: localDateSchema.optional(),
  /** Free text over the description. */
  q: z.string().trim().min(1).max(100).optional(),
});

export const transactionPageSchema = pageSchema(transactionDtoSchema);

/** GET /v1/households/:id/summary?month=YYYY-MM */
export const monthQuerySchema = z.object({ month: yearMonthSchema });

export const monthlySummaryDtoSchema = z.object({
  month: yearMonthSchema,
  income: moneyDtoSchema,
  expenses: moneyDtoSchema,
  balance: moneyDtoSchema,
  /** Expenses per category, largest first. */
  expensesByCategory: z.array(
    z.object({ categoryId: categoryRefResponseSchema, amount: moneyDtoSchema }),
  ),
});

/** GET /v1/households/:id/daily-totals?month=YYYY-MM — one entry per day with movements. */
export const dailyTotalsDtoSchema = z.object({
  month: yearMonthSchema,
  days: z.array(
    z.object({ date: localDateSchema, income: moneyDtoSchema, expenses: moneyDtoSchema }),
  ),
});

export type LocalDate = z.infer<typeof localDateSchema>;
export type YearMonth = z.infer<typeof yearMonthSchema>;
export type TransactionType = z.infer<typeof transactionTypeSchema>;
export type MemberShareAmount = z.infer<typeof memberShareAmountSchema>;
export type TransactionDto = z.infer<typeof transactionDtoSchema>;
export type CreateTransactionRequest = z.infer<typeof createTransactionRequestSchema>;
export type UpdateTransactionRequest = z.infer<typeof updateTransactionRequestSchema>;
export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;
export type TransactionPage = z.infer<typeof transactionPageSchema>;
export type MonthlySummaryDto = z.infer<typeof monthlySummaryDtoSchema>;
export type DailyTotalsDto = z.infer<typeof dailyTotalsDtoSchema>;
