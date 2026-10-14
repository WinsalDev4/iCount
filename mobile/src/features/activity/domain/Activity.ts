import type { UserId } from '@/core/domain/Ids';
import type { Money } from '@/core/domain/Money';

export type ActivityType =
  | 'transaction-created'
  | 'transaction-updated'
  | 'transaction-deleted'
  | 'transaction-approved'
  | 'transaction-rejected'
  | 'settlement-created'
  | 'member-joined'
  | 'comment-added'
  /** Sent by a newer API; show it generically. */
  | 'unknown';

/** Shared movements added by another member start pending (ADR-0016). */
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface Approval {
  readonly status: ApprovalStatus;
  readonly decidedBy: UserId | null;
  readonly decidedAt: Date | null;
  readonly reason: string | null;
}

export interface ActivityItem {
  readonly id: string;
  readonly type: ActivityType;
  readonly actorId: UserId;
  readonly occurredAt: Date;
  readonly transactionId: string | null;
  readonly settlementId: string | null;
  readonly amount: Money | null;
  readonly description: string | null;
  readonly approval: Approval | null;
  readonly commentCount: number;
}

/** `to-review`: only movements pending my approval. */
export type ActivityFilter = 'all' | 'to-review';

export type ApprovalDecision =
  { readonly decision: 'approve' } | { readonly decision: 'reject'; readonly reason: string };

export interface Comment {
  readonly id: string;
  readonly transactionId: string;
  readonly authorId: UserId;
  readonly body: string;
  readonly createdAt: Date;
}
