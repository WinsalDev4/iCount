import type { ActivityFilter } from '../domain/Activity';

/** Query keys of the household tab (kept here: the shared queryKeys file belongs to track A). */
export const householdKeys = {
  activity: (householdId: string) => ['activity', householdId] as const,
  feed: (householdId: string, filter: ActivityFilter) =>
    ['activity', householdId, 'feed', filter] as const,
  reviewCount: (householdId: string) => ['activity', householdId, 'review-count'] as const,
  comments: (transactionId: string) => ['comments', transactionId] as const,
  balance: (householdId: string) => ['settlements', householdId, 'balance'] as const,
};
