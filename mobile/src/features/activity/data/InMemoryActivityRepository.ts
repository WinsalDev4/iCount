import type { UserId } from '@/core/domain/Ids';
import type { Page, PageRequest } from '@/core/domain/Page';
import type { InMemoryHouseholdLedger } from '@/features/household/data/InMemoryHouseholdLedger';
import type { Transaction } from '@/features/transactions/domain/Transaction';
import type { TransactionRepository } from '@/features/transactions/domain/TransactionRepository';

import type { ActivityFilter, ActivityItem, ApprovalDecision, Comment } from '../domain/Activity';
import { ActivityError } from '../domain/ActivityError';
import type { ActivityRepository } from '../domain/ActivityRepository';

const DEFAULT_PAGE = 20;
const MAX_PAGE = 100;

type HouseholdArg = Parameters<InMemoryHouseholdLedger['approvalOf']>[1];

/**
 * Development/test adapter (`EXPO_PUBLIC_DATA_SOURCE=memory`). The feed is DERIVED on every read
 * from the shared movements, the decisions, the comments and the settlements, so a movement added
 * from the "+" screen shows up here without anybody telling this adapter.
 */
export class InMemoryActivityRepository implements ActivityRepository {
  constructor(
    private readonly ledger: InMemoryHouseholdLedger,
    private readonly transactions: Pick<TransactionRepository, 'getById'>,
  ) {}

  async list(
    householdId: string,
    filter: ActivityFilter,
    page: PageRequest = {},
  ): Promise<Page<ActivityItem>> {
    const household = await this.ledger.household(householdId);
    const txs = await this.ledger.sharedTransactions(householdId);
    const byId = new Map(txs.map((tx) => [tx.id, tx]));
    const me = this.ledger.me;

    const created = txs.map((tx) => this.createdItem(tx, household));
    const items: ActivityItem[] =
      filter === 'to-review'
        ? created.filter((item) => item.approval?.status === 'pending' && item.actorId !== me)
        : [
            ...created,
            ...this.ledger.decisionsOf(householdId).map((d) => ({
              ...blank(`decision:${d.id}`, d.type, d.actorId, d.at),
              transactionId: d.transactionId,
              amount: byId.get(d.transactionId)?.amount ?? null,
              description: byId.get(d.transactionId)?.description ?? null,
            })),
            ...this.ledger.commentsInHousehold(householdId).map((c) => ({
              ...blank(`comment:${c.id}`, 'comment-added', c.authorId, c.createdAt),
              transactionId: c.transactionId,
              amount: byId.get(c.transactionId)?.amount ?? null,
              description: byId.get(c.transactionId)?.description ?? null,
            })),
            ...this.ledger.settlementsOf(householdId).map((s) => ({
              ...blank(`settlement:${s.id}`, 'settlement-created', s.from, s.createdAt),
              settlementId: s.id,
              amount: s.amount,
              description: s.note === '' ? null : s.note,
            })),
          ];

    items.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime() || (a.id < b.id ? 1 : -1));

    const limit = Math.min(Math.max(page.limit ?? DEFAULT_PAGE, 1), MAX_PAGE);
    const offset = Number.parseInt(page.cursor ?? '0', 10) || 0;
    const next = offset + limit;
    return {
      items: items.slice(offset, next),
      nextCursor: next < items.length ? String(next) : null,
    };
  }

  async decide(transactionId: string, decision: ApprovalDecision): Promise<ActivityItem> {
    await this.ledger.decide(transactionId, decision);
    const tx = await this.transactions.getById(transactionId);
    if (!tx) throw new ActivityError('not-found');
    return this.createdItem(tx, await this.ledger.household(tx.householdId));
  }

  async comments(transactionId: string): Promise<readonly Comment[]> {
    return this.ledger.commentsOf(transactionId).map(toComment);
  }

  async addComment(transactionId: string, body: string): Promise<Comment> {
    return toComment(await this.ledger.addComment(transactionId, body));
  }

  private createdItem(tx: Transaction, household: HouseholdArg): ActivityItem {
    return {
      ...blank(`created:${tx.id}`, 'transaction-created', tx.payerId, tx.occurredAt),
      transactionId: tx.id,
      amount: tx.amount,
      description: tx.description,
      approval: this.ledger.approvalOf(tx, household),
      commentCount: this.ledger.commentsOf(tx.id).length,
    };
  }
}

function toComment(record: Comment): Comment {
  return {
    id: record.id,
    transactionId: record.transactionId,
    authorId: record.authorId,
    body: record.body,
    createdAt: record.createdAt,
  };
}

function blank(
  id: string,
  type: ActivityItem['type'],
  actorId: UserId,
  occurredAt: Date,
): ActivityItem {
  return {
    id,
    type,
    actorId,
    occurredAt,
    transactionId: null,
    settlementId: null,
    amount: null,
    description: null,
    approval: null,
    commentCount: 0,
  };
}
