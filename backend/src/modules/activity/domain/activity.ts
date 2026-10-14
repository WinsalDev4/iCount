import { DomainError } from '../../../shared/domain/domain-error.js';
import type { ApprovalStatus } from '../../transactions/domain/transaction.js';

export type ActivityType =
  | 'transaction-created'
  | 'transaction-updated'
  | 'transaction-deleted'
  | 'transaction-approved'
  | 'transaction-rejected'
  | 'settlement-created'
  | 'member-joined'
  | 'comment-added';

/** Something that happened in a household, as the modules report it. */
export interface ActivityEvent {
  readonly householdId: string;
  readonly type: ActivityType;
  readonly actorId: string;
  readonly transactionId?: string;
  readonly settlementId?: string;
  /** Amount involved, when there is one (movement, settlement). */
  readonly amountMinor?: number;
  readonly currency?: string;
  /** Short text of the movement or settlement. */
  readonly description?: string;
}

/**
 * Port every module uses to write to the household feed (Android analogy: an
 * event bus with a single persistent subscriber). It runs inside the caller's
 * database transaction, so the event exists only if the change does.
 */
export abstract class ActivityLog {
  /** Returns the id of the new activity item. */
  abstract record(event: ActivityEvent): Promise<string>;
}

export interface ApprovalView {
  readonly status: ApprovalStatus;
  readonly decidedBy: string | null;
  readonly decidedAt: Date | null;
  readonly reason: string | null;
}

/** One row of the feed, with the current approval state and comment count of its movement. */
export interface ActivityItem {
  readonly id: string;
  readonly householdId: string;
  readonly type: ActivityType;
  readonly actorId: string;
  readonly occurredAt: Date;
  readonly transactionId: string | null;
  readonly settlementId: string | null;
  readonly amountMinor: number | null;
  readonly currency: string | null;
  readonly description: string | null;
  readonly approval: ApprovalView | null;
  readonly commentCount: number;
}

/** Keyset position: the last item of the previous page. */
export interface ActivityCursor {
  readonly occurredAt: Date;
  readonly id: string;
}

/** `to-review`: only movements waiting for the viewer's approval. */
export type ActivityFilter = 'all' | 'to-review';

export abstract class ActivityFeed {
  /** Newest first. */
  abstract list(
    householdId: string,
    viewerId: string,
    filter: ActivityFilter,
    after: ActivityCursor | null,
    limit: number,
  ): Promise<{ items: ActivityItem[]; next: ActivityCursor | null }>;
  abstract findById(id: string): Promise<ActivityItem | null>;
}

export interface Comment {
  readonly id: string;
  readonly transactionId: string;
  readonly authorId: string;
  readonly body: string;
  readonly createdAt: Date;
}

export abstract class CommentRepository {
  /** Oldest first. */
  abstract listForTransaction(transactionId: string): Promise<Comment[]>;
  abstract add(comment: Comment): Promise<void>;
}

export class InvalidActivityCursorError extends DomainError {
  readonly kind = 'invalid';
  readonly code = 'invalid-cursor';
  readonly title = 'Invalid page cursor';

  constructor() {
    super('The cursor is not valid. Start again from the first page.');
  }
}
