import type { Page, PageRequest } from '@/core/domain/Page';

import type { ActivityFilter, ActivityItem, ApprovalDecision, Comment } from './Activity';

/**
 * Port for the household activity feed, approvals and comments.
 * Implementations: InMemory (B-5.1) and ApiActivityRepository (A-5.1).
 * Failures reject with `ActivityError`.
 */
export interface ActivityRepository {
  /** Newest first. */
  list(householdId: string, filter: ActivityFilter, page: PageRequest): Promise<Page<ActivityItem>>;
  decide(transactionId: string, decision: ApprovalDecision): Promise<ActivityItem>;
  /** Oldest first. */
  comments(transactionId: string): Promise<readonly Comment[]>;
  addComment(transactionId: string, body: string): Promise<Comment>;
}
