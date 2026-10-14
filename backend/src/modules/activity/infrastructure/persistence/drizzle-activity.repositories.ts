import { Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq, inArray, type SQL, sql } from 'drizzle-orm';

import { Clock } from '../../../../shared/application/clock.js';
import { IdGenerator } from '../../../../shared/application/id-generator.js';
import { DatabaseContext } from '../../../../shared/database/database-context.js';
import {
  transactionApprovalsTable,
  transactionsTable,
} from '../../../transactions/infrastructure/persistence/transactions.schema.js';
import {
  type ActivityCursor,
  type ActivityEvent,
  ActivityFeed,
  type ActivityFilter,
  type ActivityItem,
  ActivityLog,
  type ApprovalView,
  type Comment,
  CommentRepository,
} from '../../domain/activity.js';
import { activitiesTable, commentsTable } from './activity.schema.js';

const a = activitiesTable;
const c = commentsTable;
const t = transactionsTable;
const v = transactionApprovalsTable;

/** Movement events that can need the viewer's approval. */
const REVIEWABLE = sql`('transaction-created', 'transaction-updated')`;

@Injectable()
export class DrizzleActivityLog extends ActivityLog {
  constructor(
    private readonly context: DatabaseContext,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {
    super();
  }

  async record(event: ActivityEvent): Promise<string> {
    const id = this.ids.next();
    await this.context.db.insert(a).values({
      id,
      householdId: event.householdId,
      type: event.type,
      actorId: event.actorId,
      occurredAt: this.clock.now(),
      transactionId: event.transactionId ?? null,
      settlementId: event.settlementId ?? null,
      amountMinor: event.amountMinor ?? null,
      currency: event.currency ?? null,
      description: event.description ?? null,
    });
    return id;
  }
}

@Injectable()
export class DrizzleActivityFeed extends ActivityFeed {
  constructor(private readonly context: DatabaseContext) {
    super();
  }

  async list(
    householdId: string,
    viewerId: string,
    filter: ActivityFilter,
    after: ActivityCursor | null,
    limit: number,
  ): Promise<{ items: ActivityItem[]; next: ActivityCursor | null }> {
    const conditions: (SQL | undefined)[] = [
      eq(a.householdId, householdId),
      filter === 'to-review' ? toReview(viewerId) : undefined,
      after
        ? sql`(${a.occurredAt}, ${a.id}) < (${after.occurredAt.toISOString()}::timestamptz, ${after.id}::uuid)`
        : undefined,
    ];
    // One extra row tells whether there is a next page.
    const rows = await this.context.db
      .select()
      .from(a)
      .where(and(...conditions))
      .orderBy(desc(a.occurredAt), desc(a.id))
      .limit(limit + 1);
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return {
      items: await this.withMovementState(page),
      next: rows.length > limit && last ? { occurredAt: last.occurredAt, id: last.id } : null,
    };
  }

  async findById(id: string): Promise<ActivityItem | null> {
    const rows = await this.context.db.select().from(a).where(eq(a.id, id)).limit(1);
    const [item] = await this.withMovementState(rows);
    return item ?? null;
  }

  /** Current approval and comment count of the movements on the page: three queries, no N+1. */
  private async withMovementState(rows: (typeof a.$inferSelect)[]): Promise<ActivityItem[]> {
    const ids = [...new Set(rows.flatMap((row) => (row.transactionId ? [row.transactionId] : [])))];
    const db = this.context.db;
    const [statuses, votes, counts] =
      ids.length === 0
        ? [[], [], []]
        : await Promise.all([
            db.select({ id: t.id, status: t.approvalStatus }).from(t).where(inArray(t.id, ids)),
            db.select().from(v).where(inArray(v.transactionId, ids)).orderBy(asc(v.decidedAt)),
            db
              .select({ transactionId: c.transactionId, total: count() })
              .from(c)
              .where(inArray(c.transactionId, ids))
              .groupBy(c.transactionId),
          ]);

    const approvalOf = (transactionId: string | null): ApprovalView | null => {
      const status = statuses.find((row) => row.id === transactionId)?.status;
      if (!status) return null;
      const round = votes.filter((vote) => vote.transactionId === transactionId);
      // The rejection explains the state; otherwise the latest decision.
      const decisive = round.find((vote) => vote.decision === 'reject') ?? round.at(-1);
      return {
        status,
        decidedBy: decisive?.memberId ?? null,
        decidedAt: decisive?.decidedAt ?? null,
        reason: decisive?.reason ?? null,
      };
    };

    return rows.map((row) => ({
      ...row,
      approval: approvalOf(row.transactionId),
      commentCount: counts.find((entry) => entry.transactionId === row.transactionId)?.total ?? 0,
    }));
  }
}

/**
 * Pending movements the viewer takes part in, did not create and has not decided
 * yet; one row per movement (its latest create/update event).
 */
function toReview(viewerId: string): SQL {
  return sql`"activities"."type" in ${REVIEWABLE}
    and exists (
      select 1 from "transactions" tx
      where tx."id" = "activities"."transaction_id"
        and tx."approval_status" = 'pending'
        and tx."created_by" <> ${viewerId}::uuid
        and exists (
          select 1 from "transaction_shares" sh
          where sh."transaction_id" = tx."id" and sh."member_id" = ${viewerId}::uuid
        )
        and not exists (
          select 1 from "transaction_approvals" vo
          where vo."transaction_id" = tx."id" and vo."member_id" = ${viewerId}::uuid
        )
    )
    and not exists (
      select 1 from "activities" later
      where later."transaction_id" = "activities"."transaction_id"
        and later."type" in ${REVIEWABLE}
        and (later."occurred_at", later."id") > ("activities"."occurred_at", "activities"."id")
    )`;
}

@Injectable()
export class DrizzleCommentRepository extends CommentRepository {
  constructor(private readonly context: DatabaseContext) {
    super();
  }

  listForTransaction(transactionId: string): Promise<Comment[]> {
    return this.context.db
      .select()
      .from(c)
      .where(eq(c.transactionId, transactionId))
      .orderBy(asc(c.createdAt), asc(c.id));
  }

  async add(comment: Comment): Promise<void> {
    await this.context.db.insert(c).values(comment);
  }
}
