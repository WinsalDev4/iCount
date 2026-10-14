import { z } from 'zod';

import { categoryRefResponseSchema, categoryRefSchema } from './category.ts';
import { budgetIdSchema, householdIdSchema } from './ids.ts';
import { moneyDtoSchema } from './money.ts';
import { positiveMoneySchema, yearMonthSchema } from './transaction.ts';

/** Spending limit for one category in one month, with the progress computed by the API. */
export const budgetDtoSchema = z.object({
  id: budgetIdSchema,
  householdId: householdIdSchema,
  categoryId: categoryRefResponseSchema,
  month: yearMonthSchema,
  limit: positiveMoneySchema,
  /** Expenses of that category in that month. */
  spent: moneyDtoSchema,
  /** `limit − spent`; negative when the budget is exceeded. */
  remaining: moneyDtoSchema,
});

/** POST /v1/households/:id/budgets → BudgetDto. One budget per category and month. */
export const createBudgetRequestSchema = z.object({
  categoryId: categoryRefSchema,
  month: yearMonthSchema,
  limit: positiveMoneySchema,
});

/** PATCH /v1/budgets/:id → BudgetDto. */
export const updateBudgetRequestSchema = z.object({ limit: positiveMoneySchema });

/**
 * POST /v1/budgets/move → BudgetDto[] (both budgets).
 * Moves part of one budget's limit to another of the same month; the total stays the same.
 */
export const moveBudgetAmountRequestSchema = z
  .object({
    fromBudgetId: budgetIdSchema,
    toBudgetId: budgetIdSchema,
    amount: positiveMoneySchema,
  })
  .refine((move) => move.fromBudgetId !== move.toBudgetId, {
    message: 'Choose two different budgets',
    path: ['toBudgetId'],
  });

export type BudgetDto = z.infer<typeof budgetDtoSchema>;
export type CreateBudgetRequest = z.infer<typeof createBudgetRequestSchema>;
export type UpdateBudgetRequest = z.infer<typeof updateBudgetRequestSchema>;
export type MoveBudgetAmountRequest = z.infer<typeof moveBudgetAmountRequestSchema>;
