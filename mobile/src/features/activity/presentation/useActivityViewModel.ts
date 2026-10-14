import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { useDependencies } from '@/core/di/DependenciesProvider';
import { useSessionQuery } from '@/features/auth/presentation/session';
import { useActiveHousehold } from '@/features/household/presentation/households';
import { createNameOf } from '@/features/household/presentation/memberNames';

import type { ActivityFilter, ApprovalStatus } from '../domain/Activity';
import { householdKeys } from './activityKeys';
import {
  activityErrorMessage,
  APPROVAL_LABELS,
  describeActivity,
  formatWhen,
} from './activityText';

const PAGE_SIZE = 15;

export interface ActivityRow {
  readonly id: string;
  /** Name for the avatar: whoever did it. */
  readonly actor: string;
  readonly text: string;
  readonly amount: string | null;
  readonly when: string;
  readonly approval: { readonly status: ApprovalStatus; readonly label: string } | null;
  readonly transactionId: string | null;
  /** Only the row of the movement itself carries the comments (event rows just link to it). */
  readonly canComment: boolean;
  /** Somebody else's pending movement: I can approve or reject it. */
  readonly canDecide: boolean;
  readonly commentCount: number;
}

export interface CommentRow {
  readonly id: string;
  readonly author: string;
  readonly body: string;
  readonly when: string;
}

export type ActivityUiState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message: string }
  | {
      readonly status: 'ready';
      readonly filter: ActivityFilter;
      readonly toReviewCount: number;
      readonly rows: readonly ActivityRow[];
      readonly hasMore: boolean;
      readonly loadingMore: boolean;
      /** Transaction being decided right now (disables its buttons). */
      readonly busyId: string | null;
      /** Reject form open for this movement; the reason is required. */
      readonly rejecting: {
        readonly transactionId: string;
        readonly reason: string;
        readonly canConfirm: boolean;
      } | null;
      readonly comments: {
        readonly transactionId: string;
        readonly loading: boolean;
        readonly items: readonly CommentRow[];
        readonly draft: string;
        readonly canSend: boolean;
      } | null;
      readonly error: string | null;
    };

/**
 * ViewModel of the activity feed (screen 09-C): what happened in the household, a "por revisar"
 * filter, approve / reject (with a reason) and comments on a movement.
 */
export function useActivityViewModel() {
  const { listActivity, decideApproval, listComments, addComment } = useDependencies().activity;
  const queryClient = useQueryClient();
  const household = useActiveHousehold();
  const householdId = household?.id ?? '';
  const meId = useSessionQuery().data?.user.id as string | undefined;
  const today = useMemo(() => new Date(), []);

  const [filter, setFilter] = useState<ActivityFilter>('all');
  const [rejecting, setRejecting] = useState<{ transactionId: string; reason: string } | null>(
    null,
  );
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const feed = useInfiniteQuery({
    queryKey: householdKeys.feed(householdId, filter),
    queryFn: ({ pageParam }) =>
      listActivity.execute(householdId, filter, { cursor: pageParam, limit: PAGE_SIZE }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: household !== undefined,
  });
  const review = useQuery({
    queryKey: householdKeys.reviewCount(householdId),
    queryFn: async () =>
      (await listActivity.execute(householdId, 'to-review', { limit: 100 })).items.length,
    enabled: household !== undefined,
  });
  const commentsQuery = useQuery({
    queryKey: householdKeys.comments(openComments ?? ''),
    queryFn: () => listComments.execute(openComments ?? ''),
    enabled: openComments !== null,
  });

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: householdKeys.activity(householdId) }),
      queryClient.invalidateQueries({ queryKey: householdKeys.balance(householdId) }),
    ]);
  };

  const decide = useMutation({
    mutationFn: (input: { transactionId: string; reason?: string }) =>
      decideApproval.execute(
        input.transactionId,
        input.reason === undefined
          ? { decision: 'approve' }
          : { decision: 'reject', reason: input.reason },
      ),
    onSuccess: refreshAll,
  });
  const send = useMutation({
    mutationFn: (input: { transactionId: string; body: string }) =>
      addComment.execute(input.transactionId, input.body),
    onSuccess: async (_comment, input) => {
      await queryClient.invalidateQueries({
        queryKey: householdKeys.comments(input.transactionId),
      });
      await queryClient.invalidateQueries({ queryKey: householdKeys.activity(householdId) });
    },
  });

  const state = useMemo<ActivityUiState>(() => {
    if (!household) return { status: 'loading' };
    if (feed.isError) return { status: 'error', message: 'No hemos podido cargar la actividad.' };
    if (!feed.data) return { status: 'loading' };

    const nameOf = createNameOf(household.members, meId);
    const rows = feed.data.pages.flatMap((page) =>
      page.items.map<ActivityRow>((item) => ({
        id: item.id,
        actor: nameOf(item.actorId),
        text: describeActivity(item, nameOf),
        amount: item.amount?.format() ?? null,
        when: formatWhen(item.occurredAt, today),
        approval: item.approval
          ? { status: item.approval.status, label: APPROVAL_LABELS[item.approval.status] }
          : null,
        transactionId: item.transactionId,
        canComment: item.type === 'transaction-created' && item.transactionId !== null,
        canDecide:
          item.type === 'transaction-created' &&
          item.approval?.status === 'pending' &&
          item.actorId !== meId,
        commentCount: item.commentCount,
      })),
    );
    return {
      status: 'ready',
      filter,
      toReviewCount: review.data ?? 0,
      rows,
      hasMore: feed.hasNextPage,
      loadingMore: feed.isFetchingNextPage,
      busyId: decide.isPending ? (decide.variables?.transactionId ?? null) : null,
      rejecting: rejecting
        ? { ...rejecting, canConfirm: rejecting.reason.trim().length > 0 && !decide.isPending }
        : null,
      comments: openComments
        ? {
            transactionId: openComments,
            loading: commentsQuery.isPending,
            items: (commentsQuery.data ?? []).map((c) => ({
              id: c.id,
              author: nameOf(c.authorId),
              body: c.body,
              when: formatWhen(c.createdAt, today),
            })),
            draft,
            canSend: draft.trim().length > 0 && !send.isPending,
          }
        : null,
      error,
    };
  }, [
    household,
    feed.isError,
    feed.data,
    feed.hasNextPage,
    feed.isFetchingNextPage,
    review.data,
    meId,
    today,
    filter,
    decide.isPending,
    decide.variables,
    rejecting,
    openComments,
    commentsQuery.isPending,
    commentsQuery.data,
    draft,
    send.isPending,
    error,
  ]);

  async function approve(transactionId: string) {
    setError(null);
    try {
      await decide.mutateAsync({ transactionId });
    } catch (e) {
      setError(activityErrorMessage(e));
    }
  }

  async function confirmReject() {
    if (!rejecting) return;
    setError(null);
    try {
      await decide.mutateAsync({
        transactionId: rejecting.transactionId,
        reason: rejecting.reason,
      });
      setRejecting(null);
    } catch (e) {
      setError(activityErrorMessage(e));
    }
  }

  async function sendComment() {
    if (!openComments || draft.trim().length === 0) return;
    setError(null);
    try {
      await send.mutateAsync({ transactionId: openComments, body: draft });
      setDraft('');
    } catch (e) {
      setError(activityErrorMessage(e));
    }
  }

  return {
    state,
    selectFilter: setFilter,
    approve,
    startReject: (transactionId: string) => setRejecting({ transactionId, reason: '' }),
    changeReason: (reason: string) =>
      setRejecting((current) => (current ? { ...current, reason } : current)),
    cancelReject: () => setRejecting(null),
    confirmReject,
    toggleComments: (transactionId: string) => {
      setDraft('');
      setOpenComments((current) => (current === transactionId ? null : transactionId));
    },
    changeDraft: setDraft,
    sendComment,
    loadMore: () => feed.fetchNextPage(),
    refresh: () => feed.refetch(),
  };
}
