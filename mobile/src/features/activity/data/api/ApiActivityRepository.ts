import { activityItemDtoSchema, activityPageSchema, commentDtoSchema } from '@icount/contracts';
import { z } from 'zod';

import type { Page, PageRequest } from '@/core/domain/Page';
import type { HttpError } from '@/core/network/HttpError';
import type { HttpClient, RequestOptions } from '@/core/network/httpClient';
import { isConnectivityError, problemCode } from '@/core/network/problemCode';

import type {
  ActivityFilter,
  ActivityItem,
  ApprovalDecision,
  Comment,
} from '../../domain/Activity';
import { ActivityError } from '../../domain/ActivityError';
import type { ActivityRepository } from '../../domain/ActivityRepository';
import { toActivityItem, toComment, toDecisionRequest } from './activityMapper';

/** ActivityRepository over the API. `http` is the authenticated client. */
export class ApiActivityRepository implements ActivityRepository {
  constructor(private readonly http: HttpClient) {}

  async list(
    householdId: string,
    filter: ActivityFilter,
    page: PageRequest,
  ): Promise<Page<ActivityItem>> {
    const result = await this.call(`/v1/households/${householdId}/activity`, {
      schema: activityPageSchema,
      query: { filter, cursor: page.cursor, limit: page.limit },
    });
    return { items: result.items.map(toActivityItem), nextCursor: result.nextCursor };
  }

  async decide(transactionId: string, decision: ApprovalDecision): Promise<ActivityItem> {
    return toActivityItem(
      await this.call(`/v1/transactions/${transactionId}/approval`, {
        method: 'POST',
        body: toDecisionRequest(decision),
        schema: activityItemDtoSchema,
      }),
    );
  }

  async comments(transactionId: string): Promise<readonly Comment[]> {
    const comments = await this.call(`/v1/transactions/${transactionId}/comments`, {
      schema: z.array(commentDtoSchema),
    });
    return comments.map(toComment);
  }

  async addComment(transactionId: string, body: string): Promise<Comment> {
    return toComment(
      await this.call(`/v1/transactions/${transactionId}/comments`, {
        method: 'POST',
        body: { body },
        schema: commentDtoSchema,
      }),
    );
  }

  private async call<S extends z.ZodType>(path: string, options: RequestOptions<S>) {
    const result = await this.http.request(path, options);
    if (!result.ok) throw toActivityError(result.error);
    return result.value;
  }
}

export function toActivityError(error: HttpError): ActivityError {
  if (isConnectivityError(error)) return new ActivityError('network');
  if (error.kind !== 'http') return new ActivityError('unknown');
  const detail = error.problem.detail;
  switch (problemCode(error)) {
    case 'transaction-not-found':
    case 'household-not-found':
      return new ActivityError('not-found', detail);
    case 'already-decided':
      return new ActivityError('already-decided', detail);
    case 'cannot-approve-own':
      return new ActivityError('cannot-approve-own', detail);
    case 'not-an-approver':
      return new ActivityError('forbidden', detail);
  }
  return new ActivityError('unknown', detail);
}
