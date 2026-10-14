import type { ActivityItemDto, CommentDto } from '@icount/contracts';

import type { UserId } from '@/core/domain/Ids';
import { Money } from '@/core/domain/Money';

import type { ActivityItem, ApprovalDecision, Comment } from '../../domain/Activity';

const asUserId = (id: string) => id as UserId;

export function toActivityItem(dto: ActivityItemDto): ActivityItem {
  return {
    id: dto.id,
    type: dto.type,
    actorId: asUserId(dto.actorId),
    occurredAt: new Date(dto.occurredAt),
    transactionId: dto.transactionId,
    settlementId: dto.settlementId,
    amount: dto.amount && Money.ofMinor(dto.amount.amountMinor, dto.amount.currency),
    description: dto.description,
    approval: dto.approval && {
      status: dto.approval.status,
      decidedBy: dto.approval.decidedBy && asUserId(dto.approval.decidedBy),
      decidedAt: dto.approval.decidedAt === null ? null : new Date(dto.approval.decidedAt),
      reason: dto.approval.reason,
    },
    commentCount: dto.commentCount,
  };
}

export function toComment(dto: CommentDto): Comment {
  return {
    id: dto.id,
    transactionId: dto.transactionId,
    authorId: asUserId(dto.authorId),
    body: dto.body,
    createdAt: new Date(dto.createdAt),
  };
}

/** Request body for POST /v1/transactions/:id/approval. */
export function toDecisionRequest(decision: ApprovalDecision) {
  return decision.decision === 'reject'
    ? { decision: 'reject' as const, reason: decision.reason }
    : { decision: 'approve' as const };
}
