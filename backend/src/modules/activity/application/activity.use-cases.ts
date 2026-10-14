import { z } from 'zod';

import type { Clock } from '../../../shared/application/clock.js';
import type { IdGenerator } from '../../../shared/application/id-generator.js';
import type { TransactionRunner } from '../../../shared/application/transaction-runner.js';
import type { HouseholdAccess } from '../../households/application/household-access.js';
import type { TransactionRepository } from '../../transactions/domain/transaction-repository.js';
import {
  type Transaction,
  TransactionNotFoundError,
} from '../../transactions/domain/transaction.js';
import {
  type ActivityCursor,
  type ActivityFeed,
  type ActivityFilter,
  type ActivityItem,
  type ActivityLog,
  type Comment,
  type CommentRepository,
  InvalidActivityCursorError,
} from '../domain/activity.js';

const cursorSchema = z.object({ o: z.iso.datetime(), i: z.uuid() });

/** Opaque cursor = base64url(JSON) of the last item's sort key. */
export function encodeActivityCursor(cursor: ActivityCursor): string {
  return Buffer.from(JSON.stringify({ o: cursor.occurredAt.toISOString(), i: cursor.id })).toString(
    'base64url',
  );
}

export function decodeActivityCursor(value: string): ActivityCursor {
  try {
    const parsed = cursorSchema.parse(JSON.parse(Buffer.from(value, 'base64url').toString('utf8')));
    return { occurredAt: new Date(parsed.o), id: parsed.i };
  } catch {
    throw new InvalidActivityCursorError();
  }
}

/** A movement visible to the member (404 otherwise, never 403: no existence leaks). */
async function loadMovement(
  transactions: TransactionRepository,
  access: HouseholdAccess,
  id: string,
  actorId: string,
): Promise<Transaction> {
  const transaction = await transactions.findById(id);
  if (!transaction) throw new TransactionNotFoundError(id);
  try {
    await access.requireMember(transaction.householdId, actorId);
  } catch {
    throw new TransactionNotFoundError(id);
  }
  return transaction;
}

export class ListActivity {
  constructor(
    private readonly access: HouseholdAccess,
    private readonly feed: ActivityFeed,
  ) {}

  async execute(
    actorId: string,
    householdId: string,
    filter: ActivityFilter,
    page: { cursor?: string; limit: number },
  ): Promise<{ items: ActivityItem[]; nextCursor: string | null }> {
    await this.access.requireMember(householdId, actorId);
    const after = page.cursor ? decodeActivityCursor(page.cursor) : null;
    const result = await this.feed.list(householdId, actorId, filter, after, page.limit);
    return {
      items: result.items,
      nextCursor: result.next ? encodeActivityCursor(result.next) : null,
    };
  }
}

/** Approve or reject a shared movement added by someone else (ADR-0016). */
export class DecideOnTransaction {
  constructor(
    private readonly access: HouseholdAccess,
    private readonly transactions: TransactionRepository,
    private readonly log: ActivityLog,
    private readonly feed: ActivityFeed,
    private readonly runner: TransactionRunner,
    private readonly clock: Clock,
  ) {}

  async execute(
    actorId: string,
    transactionId: string,
    decision: 'approve' | 'reject',
    reason: string | null,
  ): Promise<ActivityItem> {
    const activityId = await this.runner.run(async () => {
      const transaction = await loadMovement(
        this.transactions,
        this.access,
        transactionId,
        actorId,
      );
      transaction.decide(actorId, decision, reason, this.clock.now());
      await this.transactions.save(transaction);
      const { householdId, amountMinor, currency, description } = transaction.snapshot;
      return this.log.record({
        householdId,
        type: decision === 'approve' ? 'transaction-approved' : 'transaction-rejected',
        actorId,
        transactionId,
        amountMinor,
        currency,
        description: reason ?? description,
      });
    });
    return (await this.feed.findById(activityId))!;
  }
}

export class ListComments {
  constructor(
    private readonly access: HouseholdAccess,
    private readonly transactions: TransactionRepository,
    private readonly comments: CommentRepository,
  ) {}

  async execute(actorId: string, transactionId: string): Promise<Comment[]> {
    await loadMovement(this.transactions, this.access, transactionId, actorId);
    return this.comments.listForTransaction(transactionId);
  }
}

export class AddComment {
  constructor(
    private readonly access: HouseholdAccess,
    private readonly transactions: TransactionRepository,
    private readonly comments: CommentRepository,
    private readonly log: ActivityLog,
    private readonly runner: TransactionRunner,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  execute(actorId: string, transactionId: string, body: string): Promise<Comment> {
    return this.runner.run(async () => {
      const transaction = await loadMovement(
        this.transactions,
        this.access,
        transactionId,
        actorId,
      );
      const comment: Comment = {
        id: this.ids.next(),
        transactionId,
        authorId: actorId,
        body,
        createdAt: this.clock.now(),
      };
      await this.comments.add(comment);
      await this.log.record({
        householdId: transaction.householdId,
        type: 'comment-added',
        actorId,
        transactionId,
        description: transaction.snapshot.description,
      });
      return comment;
    });
  }
}
