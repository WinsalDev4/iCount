import { z } from 'zod';

import { householdIdSchema, settlementIdSchema, userIdSchema } from './ids.ts';
import { moneyDtoSchema } from './money.ts';
import { localDateSchema, positiveMoneySchema } from './transaction.ts';

/**
 * Net position of one member over the approved shared movements (ADR-0016):
 * `net = paid − owed`. Positive: the others owe them. Negative: they owe.
 * The nets of a household always add up to zero.
 */
export const memberBalanceSchema = z.object({
  memberId: userIdSchema,
  paid: moneyDtoSchema,
  owed: moneyDtoSchema,
  net: moneyDtoSchema,
});

/** One payment from a debtor to a creditor that settles (part of) the balance. */
export const transferSchema = z
  .object({
    fromMemberId: userIdSchema,
    toMemberId: userIdSchema,
    amount: positiveMoneySchema,
  })
  .refine((transfer) => transfer.fromMemberId !== transfer.toMemberId, {
    message: 'A member cannot pay themselves',
    path: ['toMemberId'],
  });

/** GET /v1/households/:id/balance?from=…&to=… */
export const balanceQuerySchema = z.object({
  from: localDateSchema.optional(),
  to: localDateSchema.optional(),
});

export const householdBalanceDtoSchema = z.object({
  householdId: householdIdSchema,
  members: z.array(memberBalanceSchema),
  /** Fewest transfers that bring every net to zero (greedy algorithm, ADR-0016). */
  suggestedTransfers: z.array(transferSchema),
  /** Shared movements waiting for approval; they are NOT included in the nets yet. */
  pendingApprovalCount: z.int().min(0),
});

export const settlementMethodSchema = z.enum(['bizum', 'bank-transfer', 'cash', 'other']);

export const settlementDtoSchema = z.object({
  id: settlementIdSchema,
  householdId: householdIdSchema,
  fromMemberId: userIdSchema,
  toMemberId: userIdSchema,
  amount: positiveMoneySchema,
  method: settlementMethodSchema,
  note: z.string().max(140),
  settledOn: localDateSchema,
  createdBy: userIdSchema,
  createdAt: z.iso.datetime(),
});

/** POST /v1/households/:id/settlements → SettlementDto. */
export const createSettlementRequestSchema = z
  .object({
    fromMemberId: userIdSchema,
    toMemberId: userIdSchema,
    amount: positiveMoneySchema,
    method: settlementMethodSchema,
    note: z.string().trim().max(140).default(''),
    settledOn: localDateSchema,
  })
  .refine((settlement) => settlement.fromMemberId !== settlement.toMemberId, {
    message: 'A member cannot pay themselves',
    path: ['toMemberId'],
  });

export type MemberBalance = z.infer<typeof memberBalanceSchema>;
export type Transfer = z.infer<typeof transferSchema>;
export type BalanceQuery = z.infer<typeof balanceQuerySchema>;
export type HouseholdBalanceDto = z.infer<typeof householdBalanceDtoSchema>;
export type SettlementMethod = z.infer<typeof settlementMethodSchema>;
export type SettlementDto = z.infer<typeof settlementDtoSchema>;
export type CreateSettlementRequest = z.infer<typeof createSettlementRequestSchema>;
