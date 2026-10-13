import { z } from 'zod';

import {
  activityIdSchema,
  commentIdSchema,
  householdIdSchema,
  settlementIdSchema,
  transactionIdSchema,
  userIdSchema,
} from './ids.ts';
import { moneyDtoSchema } from './money.ts';
import { pageRequestSchema, pageSchema } from './pagination.ts';

export const ACTIVITY_TYPES = [
  'transaction-created',
  'transaction-updated',
  'transaction-deleted',
  'transaction-approved',
  'transaction-rejected',
  'settlement-created',
  'member-joined',
  'comment-added',
] as const;

/** Tolerant reader: an older app shows unknown event types generically instead of failing. */
export const activityTypeResponseSchema = z.enum([...ACTIVITY_TYPES, 'unknown']).catch('unknown');

/**
 * Shared movements added by another member start as `pending` (ADR-0016): they
 * do not count in balances until approved by the others.
 */
export const approvalStatusSchema = z.enum(['pending', 'approved', 'rejected']);

export const approvalDtoSchema = z.object({
  status: approvalStatusSchema,
  decidedBy: userIdSchema.nullable(),
  decidedAt: z.iso.datetime().nullable(),
  reason: z.string().max(140).nullable(),
});

export const activityItemDtoSchema = z.object({
  id: activityIdSchema,
  householdId: householdIdSchema,
  type: activityTypeResponseSchema,
  actorId: userIdSchema,
  occurredAt: z.iso.datetime(),
  transactionId: transactionIdSchema.nullable(),
  settlementId: settlementIdSchema.nullable(),
  /** Amount involved, when the event has one (movement, settlement). */
  amount: moneyDtoSchema.nullable(),
  /** Short text of the movement or settlement (not a localised sentence). */
  description: z.string().max(140).nullable(),
  /** Present for shared movements that need approval. */
  approval: approvalDtoSchema.nullable(),
  commentCount: z.int().min(0),
});

/** GET /v1/households/:id/activity?filter=to-review&cursor=… → ActivityPage, newest first. */
export const activityQuerySchema = pageRequestSchema.extend({
  /** `to-review`: only movements pending MY approval. */
  filter: z.enum(['all', 'to-review']).default('all'),
});

export const activityPageSchema = pageSchema(activityItemDtoSchema);

/** POST /v1/transactions/:id/approval → ActivityItemDto. */
export const approvalDecisionRequestSchema = z
  .object({
    decision: z.enum(['approve', 'reject']),
    reason: z.string().trim().min(1).max(140).optional(),
  })
  .refine((decision) => decision.decision === 'approve' || decision.reason !== undefined, {
    message: 'Explain why you reject it',
    path: ['reason'],
  });

export const commentDtoSchema = z.object({
  id: commentIdSchema,
  transactionId: transactionIdSchema,
  authorId: userIdSchema,
  body: z.string().min(1).max(500),
  createdAt: z.iso.datetime(),
});

/** POST /v1/transactions/:id/comments → CommentDto; GET lists them oldest first. */
export const createCommentRequestSchema = z.object({ body: z.string().trim().min(1).max(500) });

export type ActivityType = (typeof ACTIVITY_TYPES)[number];
export type ApprovalStatus = z.infer<typeof approvalStatusSchema>;
export type ApprovalDto = z.infer<typeof approvalDtoSchema>;
export type ActivityItemDto = z.infer<typeof activityItemDtoSchema>;
export type ActivityQuery = z.infer<typeof activityQuerySchema>;
export type ActivityPage = z.infer<typeof activityPageSchema>;
export type ApprovalDecisionRequest = z.infer<typeof approvalDecisionRequestSchema>;
export type CommentDto = z.infer<typeof commentDtoSchema>;
export type CreateCommentRequest = z.infer<typeof createCommentRequestSchema>;
