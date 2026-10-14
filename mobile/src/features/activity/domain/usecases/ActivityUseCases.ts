import type { Page, PageRequest } from '@/core/domain/Page';

import type { ActivityFilter, ActivityItem, ApprovalDecision, Comment } from '../Activity';
import { ActivityError } from '../ActivityError';
import type { ActivityRepository } from '../ActivityRepository';

const MAX_REASON = 140;
const MAX_COMMENT = 500;

/** The household feed, newest first. `to-review` = movements waiting for MY approval. */
export class ListActivity {
  constructor(private readonly repository: Pick<ActivityRepository, 'list'>) {}

  execute(
    householdId: string,
    filter: ActivityFilter = 'all',
    page: PageRequest = {},
  ): Promise<Page<ActivityItem>> {
    return this.repository.list(householdId, filter, page);
  }
}

/** Approves a movement, or rejects it with a reason (required, so the author knows why). */
export class DecideApproval {
  constructor(private readonly repository: Pick<ActivityRepository, 'decide'>) {}

  execute(transactionId: string, decision: ApprovalDecision): Promise<ActivityItem> {
    if (decision.decision === 'approve') return this.repository.decide(transactionId, decision);
    const reason = decision.reason.trim();
    if (reason.length === 0 || reason.length > MAX_REASON) {
      return Promise.reject(new ActivityError('unknown', 'A rejection needs a short reason'));
    }
    return this.repository.decide(transactionId, { decision: 'reject', reason });
  }
}

export class ListComments {
  constructor(private readonly repository: Pick<ActivityRepository, 'comments'>) {}

  execute(transactionId: string): Promise<readonly Comment[]> {
    return this.repository.comments(transactionId);
  }
}

export class AddComment {
  constructor(private readonly repository: Pick<ActivityRepository, 'addComment'>) {}

  execute(transactionId: string, body: string): Promise<Comment> {
    const text = body.trim();
    if (text.length === 0 || text.length > MAX_COMMENT) {
      return Promise.reject(new ActivityError('unknown', 'A comment needs 1–500 characters'));
    }
    return this.repository.addComment(transactionId, text);
  }
}
