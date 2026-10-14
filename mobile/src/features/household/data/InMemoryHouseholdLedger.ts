import type { CategoryId } from '@/core/domain/Category';
import type { UserId } from '@/core/domain/Ids';
import { Money } from '@/core/domain/Money';
import type { Approval, ApprovalDecision, Comment } from '@/features/activity/domain/Activity';
import { ActivityError } from '@/features/activity/domain/ActivityError';
import type { NewSettlement, Settlement } from '@/features/settlements/domain/Settlement';
import type { Transaction } from '@/features/transactions/domain/Transaction';
import type { TransactionRepository } from '@/features/transactions/domain/TransactionRepository';

import type { Household } from '../domain/Household';
import type { HouseholdRepository } from '../domain/HouseholdRepository';

export interface LedgerDeps {
  readonly transactions: Pick<TransactionRepository, 'list' | 'getById' | 'create'>;
  readonly households: Pick<HouseholdRepository, 'getMine'>;
  /** The signed-in member; read at every use so signing in again keeps working. */
  readonly me: () => UserId;
  readonly now?: () => Date;
}

/** A decision on a movement, kept for the feed ("Leo aprobó…"). */
export interface DecisionRecord {
  readonly id: string;
  readonly householdId: string;
  readonly transactionId: string;
  readonly type: 'transaction-approved' | 'transaction-rejected';
  readonly actorId: UserId;
  readonly at: Date;
  readonly reason: string | null;
}

export interface CommentRecord extends Comment {
  readonly householdId: string;
}

export interface SettlementRecord extends Settlement {
  readonly householdId: string;
  readonly createdAt: Date;
}

const PAGE = 100;

/**
 * The part of a shared household that the in-memory adapters need to agree on (memory mode only;
 * the real API has one database): who approved what, the comments, and the settlements.
 * Activity (the feed) and settlements (the balance) are two thin adapters over this one object.
 *
 * Approval rules of ADR-0016 as far as one device can show them:
 * - a shared movement paid by someone else is `pending` until I decide;
 * - what I add myself counts at once (there is no other person on this device to approve it);
 * - movements of personal households, or not shared, need no approval (`null`).
 */
export class InMemoryHouseholdLedger {
  private readonly decided = new Map<string, Approval>();
  private decisions: DecisionRecord[] = [];
  private comments: CommentRecord[] = [];
  private settlements: SettlementRecord[] = [];
  /** Seeding is awaited by whoever asks while it is running (the balance and the feed read at once). */
  private readonly seeding = new Map<string, Promise<void>>();
  private sequence = 0;
  private readonly now: () => Date;

  constructor(private readonly deps: LedgerDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  get me(): UserId {
    return this.deps.me();
  }

  async household(householdId: string): Promise<Household | undefined> {
    return (await this.deps.households.getMine()).find((h) => h.id === householdId);
  }

  /** Every shared movement of the household (all pages). */
  async sharedTransactions(householdId: string): Promise<Transaction[]> {
    await this.ensureSeeded(householdId);
    const all: Transaction[] = [];
    let cursor: string | undefined;
    do {
      const page = await this.deps.transactions.list(
        householdId,
        { shared: true },
        { cursor, limit: PAGE },
      );
      all.push(...page.items);
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    return all;
  }

  /** `null` when the movement needs no approval. */
  approvalOf(tx: Transaction, household: Household | undefined): Approval | null {
    if (!tx.shared || !household || household.members.length < 2) return null;
    const stored = this.decided.get(tx.id);
    if (stored) return stored;
    return tx.payerId === this.me
      ? { status: 'approved', decidedBy: null, decidedAt: null, reason: null }
      : { status: 'pending', decidedBy: null, decidedAt: null, reason: null };
  }

  /** Approves or rejects somebody else's pending movement. */
  async decide(transactionId: string, decision: ApprovalDecision): Promise<DecisionRecord> {
    const tx = await this.deps.transactions.getById(transactionId);
    if (!tx) throw new ActivityError('not-found');
    const household = await this.household(tx.householdId);
    const current = this.approvalOf(tx, household);
    if (!current) throw new ActivityError('forbidden');
    if (tx.payerId === this.me) throw new ActivityError('cannot-approve-own');
    if (current.status !== 'pending') throw new ActivityError('already-decided');

    const at = this.now();
    const approved = decision.decision === 'approve';
    this.decided.set(tx.id, {
      status: approved ? 'approved' : 'rejected',
      decidedBy: this.me,
      decidedAt: at,
      reason: decision.decision === 'reject' ? decision.reason : null,
    });
    const record: DecisionRecord = {
      id: this.nextId('decision'),
      householdId: tx.householdId,
      transactionId: tx.id,
      type: approved ? 'transaction-approved' : 'transaction-rejected',
      actorId: this.me,
      at,
      reason: decision.decision === 'reject' ? decision.reason : null,
    };
    this.decisions = [...this.decisions, record];
    return record;
  }

  decisionsOf(householdId: string): readonly DecisionRecord[] {
    return this.decisions.filter((d) => d.householdId === householdId);
  }

  commentsOf(transactionId: string): readonly CommentRecord[] {
    return this.comments.filter((c) => c.transactionId === transactionId);
  }

  commentsInHousehold(householdId: string): readonly CommentRecord[] {
    return this.comments.filter((c) => c.householdId === householdId);
  }

  async addComment(transactionId: string, body: string): Promise<CommentRecord> {
    const tx = await this.deps.transactions.getById(transactionId);
    if (!tx) throw new ActivityError('not-found');
    const comment: CommentRecord = {
      id: this.nextId('comment'),
      householdId: tx.householdId,
      transactionId,
      authorId: this.me,
      body,
      createdAt: this.now(),
    };
    this.comments = [...this.comments, comment];
    return comment;
  }

  settlementsOf(householdId: string): readonly SettlementRecord[] {
    return this.settlements.filter((s) => s.householdId === householdId);
  }

  addSettlement(input: NewSettlement): SettlementRecord {
    const record: SettlementRecord = {
      id: this.nextId('settlement'),
      householdId: input.householdId,
      from: input.from,
      to: input.to,
      amount: input.amount,
      method: input.method,
      note: input.note,
      settledOn: input.settledOn,
      createdAt: this.now(),
    };
    this.settlements = [...this.settlements, record];
    return record;
  }

  /**
   * Gives a shared household something to review the first time it is read: the other member
   * has paid three shared expenses (two still pending, one already approved by me).
   */
  ensureSeeded(householdId: string): Promise<void> {
    let running = this.seeding.get(householdId);
    if (!running) {
      running = this.seed(householdId);
      this.seeding.set(householdId, running);
    }
    return running;
  }

  private async seed(householdId: string): Promise<void> {
    const household = await this.household(householdId);
    const partner = household?.members.find((m) => m.userId !== this.me);
    if (!household || !partner) return;

    const today = this.now();
    const daysAgo = (days: number) =>
      new Date(today.getFullYear(), today.getMonth(), today.getDate() - days);
    const create = (
      description: string,
      cents: number,
      categoryId: string,
      days: number,
    ): Promise<Transaction> =>
      this.deps.transactions.create({
        householdId,
        type: 'expense',
        amount: Money.ofMinor(cents, household.currency),
        categoryId: categoryId as CategoryId,
        description,
        occurredAt: daysAgo(days),
        payerId: partner.userId,
        shared: true,
      });

    await create('Compra semanal', 8_640, 'food', 1);
    await create('Cena en casa de amigos', 5_400, 'food', 3);
    const light = await create('Factura de la luz', 6_125, 'bills', 6);
    const at = new Date(daysAgo(5).getTime() + 10 * 60 * 60 * 1000);
    this.decided.set(light.id, {
      status: 'approved',
      decidedBy: this.me,
      decidedAt: at,
      reason: null,
    });
    this.decisions = [
      ...this.decisions,
      {
        id: this.nextId('decision'),
        householdId,
        transactionId: light.id,
        type: 'transaction-approved',
        actorId: this.me,
        at,
        reason: null,
      },
    ];
  }

  private nextId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}-${this.sequence}`;
  }
}
