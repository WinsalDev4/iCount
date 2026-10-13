import { z } from 'zod';

import { debtIdSchema, householdIdSchema } from './ids.ts';
import { moneyDtoSchema } from './money.ts';
import { localDateSchema, positiveMoneySchema } from './transaction.ts';

/**
 * Interest rates in basis points (6,90 % → 690): integers, like money (ADR-0007/0015).
 * `annualRateBps` is the nominal annual rate (TIN) used by the French amortisation
 * formula; `aprBps` (TAE) is informative only, as printed by the bank.
 */
export const rateBasisPointsSchema = z.int().min(0).max(100_000);

export const debtKindSchema = z.enum(['car', 'mortgage', 'personal', 'credit-card', 'other']);

export const debtDtoSchema = z.object({
  id: debtIdSchema,
  householdId: householdIdSchema,
  name: z.string().min(1).max(60),
  kind: debtKindSchema,
  /** Amount originally borrowed. */
  principal: positiveMoneySchema,
  /** Balance still owed today (computed by the API with @icount/finance). */
  outstanding: moneyDtoSchema,
  annualRateBps: rateBasisPointsSchema,
  aprBps: rateBasisPointsSchema.nullable(),
  /** Regular monthly instalment (cuota). */
  monthlyPayment: positiveMoneySchema,
  /** First instalment date. */
  startDate: localDateSchema,
  termMonths: z.int().min(1).max(600),
  /** Date of the last instalment at the current pace. */
  endDate: localDateSchema,
  createdAt: z.iso.datetime(),
});

/** POST /v1/households/:id/debts → DebtDto. */
export const createDebtRequestSchema = z.object({
  name: z.string().trim().min(1).max(60),
  kind: debtKindSchema,
  principal: positiveMoneySchema,
  annualRateBps: rateBasisPointsSchema,
  aprBps: rateBasisPointsSchema.optional(),
  startDate: localDateSchema,
  termMonths: z.int().min(1).max(600),
  /** Optional: when omitted the API computes the French instalment. */
  monthlyPayment: positiveMoneySchema.optional(),
});

/** PATCH /v1/debts/:id → DebtDto. No defaults: only the fields sent change. */
export const updateDebtRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    kind: debtKindSchema,
    annualRateBps: rateBasisPointsSchema,
    aprBps: rateBasisPointsSchema.nullable(),
    monthlyPayment: positiveMoneySchema,
    termMonths: z.int().min(1).max(600),
  })
  .partial()
  .refine((changes) => Object.keys(changes).length > 0, { message: 'Nothing to update' });

/** One row of an amortisation schedule (cuadro de amortización). */
export const amortizationRowSchema = z.object({
  period: z.int().min(1),
  date: localDateSchema,
  payment: moneyDtoSchema,
  interest: moneyDtoSchema,
  principal: moneyDtoSchema,
  /** Balance after this payment. */
  balance: moneyDtoSchema,
});

/** GET /v1/debts/:id/schedule */
export const amortizationScheduleDtoSchema = z.object({
  debtId: debtIdSchema,
  rows: z.array(amortizationRowSchema),
  totalInterest: moneyDtoSchema,
});

export const payoffStrategySchema = z.enum(['avalanche', 'snowball']);

/** GET /v1/households/:id/debts/strategy?strategy=…&extraMonthly=… */
export const payoffStrategyQuerySchema = z.object({
  strategy: payoffStrategySchema,
  /** Extra amount per month on top of the regular instalments, in cents. */
  extraMonthlyMinor: z.coerce.number().int().min(0).default(0),
});

export const payoffStrategyResultDtoSchema = z.object({
  strategy: payoffStrategySchema,
  extraMonthly: moneyDtoSchema,
  /** Debts in the order the strategy pays them off. */
  debts: z.array(
    z.object({
      debtId: debtIdSchema,
      order: z.int().min(1),
      payoffDate: localDateSchema,
      interestPaid: moneyDtoSchema,
    }),
  ),
  totalInterest: moneyDtoSchema,
  /** When the last debt is paid off. */
  debtFreeDate: localDateSchema,
});

export type DebtKind = z.infer<typeof debtKindSchema>;
export type DebtDto = z.infer<typeof debtDtoSchema>;
export type CreateDebtRequest = z.infer<typeof createDebtRequestSchema>;
export type UpdateDebtRequest = z.infer<typeof updateDebtRequestSchema>;
export type AmortizationRow = z.infer<typeof amortizationRowSchema>;
export type AmortizationScheduleDto = z.infer<typeof amortizationScheduleDtoSchema>;
export type PayoffStrategy = z.infer<typeof payoffStrategySchema>;
export type PayoffStrategyQuery = z.infer<typeof payoffStrategyQuerySchema>;
export type PayoffStrategyResultDto = z.infer<typeof payoffStrategyResultDtoSchema>;
