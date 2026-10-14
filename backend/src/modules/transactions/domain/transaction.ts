import { splitAmount } from '@icount/finance';

import { DomainError } from '../../../shared/domain/domain-error.js';
import type { Household } from '../../households/domain/household.js';

export type TransactionType = 'income' | 'expense';

export interface ShareAmount {
  readonly memberId: string;
  readonly amountMinor: number;
}

/** ADR-0016: null when no approval is needed (not shared, or nobody else takes part). */
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface ApprovalVote {
  readonly memberId: string;
  readonly decision: 'approve' | 'reject';
  /** Required when rejecting. */
  readonly reason: string | null;
  readonly decidedAt: Date;
}

export interface TransactionProps {
  readonly id: string;
  readonly householdId: string;
  readonly type: TransactionType;
  /** Positive cents; the sign comes from `type`. */
  readonly amountMinor: number;
  readonly currency: string;
  readonly categoryId: string;
  readonly description: string;
  /** Calendar day `YYYY-MM-DD`. */
  readonly occurredOn: string;
  readonly payerId: string;
  readonly shared: boolean;
  /** Empty when not shared; otherwise they add up to `amountMinor`. */
  readonly shares: readonly ShareAmount[];
  /** Only counts in balances when null or approved. */
  readonly approvalStatus: ApprovalStatus | null;
  /** Decisions of the current round; an edit starts a new one. */
  readonly approvals: readonly ApprovalVote[];
  readonly createdBy: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type EditableFields = Pick<
  TransactionProps,
  'type' | 'amountMinor' | 'categoryId' | 'description' | 'occurredOn' | 'payerId' | 'shared'
>;

/**
 * A movement of money in a household. Its invariants (positive integer amount,
 * payer inside the household, shares computed from the household's SplitRule)
 * are enforced every time it is created or edited.
 */
export class Transaction {
  private constructor(private props: TransactionProps) {}

  static create(
    household: Household,
    fields: EditableFields & { id: string; createdBy: string; currency: string; now: Date },
  ): Transaction {
    assertCurrency(household, fields.currency);
    const transaction = new Transaction({
      ...fields,
      householdId: household.id,
      shares: [],
      approvalStatus: null,
      approvals: [],
      createdAt: fields.now,
      updatedAt: fields.now,
    });
    transaction.applyRules(household);
    return transaction;
  }

  static restore(props: TransactionProps): Transaction {
    return new Transaction(props);
  }

  get snapshot(): TransactionProps {
    return this.props;
  }

  get id(): string {
    return this.props.id;
  }

  get householdId(): string {
    return this.props.householdId;
  }

  edit(
    household: Household,
    { currency, ...changes }: Partial<EditableFields> & { currency?: string },
    now: Date,
  ): void {
    if (currency !== undefined) assertCurrency(household, currency);
    this.props = { ...this.props, ...changes, updatedAt: now };
    this.applyRules(household);
  }

  /**
   * Members who must approve it: everyone with a share except its author
   * (nobody approves their own movements).
   */
  get approvers(): string[] {
    return this.props.shares
      .map((share) => share.memberId)
      .filter((memberId) => memberId !== this.props.createdBy);
  }

  /** Whether it counts in balances (ADR-0016). */
  get counts(): boolean {
    return this.props.approvalStatus === null || this.props.approvalStatus === 'approved';
  }

  /** One member approves or rejects it; the movement is approved when every approver agrees. */
  decide(memberId: string, decision: 'approve' | 'reject', reason: string | null, now: Date): void {
    if (memberId === this.props.createdBy) throw new CannotApproveOwnError();
    if (!this.approvers.includes(memberId)) throw new NotAnApproverError();
    if (
      this.props.approvalStatus !== 'pending' ||
      this.props.approvals.some((vote) => vote.memberId === memberId)
    ) {
      throw new AlreadyDecidedError();
    }
    if (decision === 'reject' && !reason?.trim()) {
      throw new InvalidTransactionError('Explain why you reject it.');
    }
    const approvals = [
      ...this.props.approvals,
      { memberId, decision, reason: decision === 'reject' ? reason!.trim() : null, decidedAt: now },
    ];
    const approved = this.approvers.every((approver) =>
      approvals.some((vote) => vote.memberId === approver && vote.decision === 'approve'),
    );
    this.props = {
      ...this.props,
      approvals,
      approvalStatus: decision === 'reject' ? 'rejected' : approved ? 'approved' : 'pending',
    };
  }

  private applyRules(household: Household): void {
    const { amountMinor, payerId, shared, description } = this.props;
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
      throw new InvalidTransactionError('The amount must be a positive number of cents.');
    }
    if (description.length > 140) {
      throw new InvalidTransactionError('The description is limited to 140 characters.');
    }
    if (!household.isMember(payerId)) throw new PayerNotMemberError(payerId);
    if (shared && household.kind === 'personal') throw new NotSharedHouseholdError();

    this.props = {
      ...this.props,
      shares: shared
        ? splitAmount({
            amountMinor,
            payerId,
            members: household.members.map((member) => ({
              id: member.userId,
              monthlyIncomeMinor: member.monthlyIncomeMinor,
            })),
            rule: household.splitRule,
            categoryId: this.props.categoryId,
          }).map(({ memberId, amountMinor: part }) => ({ memberId, amountMinor: part }))
        : [],
    };
    // Every change to a shared movement goes back to the others for approval.
    this.props = {
      ...this.props,
      approvals: [],
      approvalStatus: this.approvers.length > 0 ? 'pending' : null,
    };
  }
}

function assertCurrency(household: Household, currency: string): void {
  if (currency !== household.currency) {
    throw new InvalidTransactionError(
      `This household uses ${household.currency}, not ${currency}.`,
      'currency-mismatch',
    );
  }
}

export class InvalidTransactionError extends DomainError {
  readonly kind = 'invalid';
  readonly title = 'Invalid movement';

  constructor(
    message: string,
    readonly code: string = 'invalid-transaction',
  ) {
    super(message);
  }
}

export class PayerNotMemberError extends DomainError {
  readonly kind = 'invalid';
  readonly code = 'payer-not-member';
  readonly title = 'The payer is not a member';

  constructor(payerId: string) {
    super(`${payerId} is not a member of this household.`);
  }
}

export class NotSharedHouseholdError extends DomainError {
  readonly kind = 'invalid';
  readonly code = 'not-shared-household';
  readonly title = 'Personal households do not share expenses';

  constructor() {
    super('Only movements of shared households can be split between members.');
  }
}

export class CannotApproveOwnError extends DomainError {
  readonly kind = 'invalid';
  readonly code = 'cannot-approve-own';
  readonly title = 'You cannot approve your own movement';

  constructor() {
    super('The other members approve the shared movements you add.');
  }
}

export class NotAnApproverError extends DomainError {
  readonly kind = 'forbidden';
  readonly code = 'not-an-approver';
  readonly title = 'This movement does not need your approval';

  constructor() {
    super('Only the members who take part in a shared movement approve it.');
  }
}

export class AlreadyDecidedError extends DomainError {
  readonly kind = 'conflict';
  readonly code = 'already-decided';
  readonly title = 'Already decided';

  constructor() {
    super('This movement is no longer waiting for your decision.');
  }
}

export class TransactionNotFoundError extends DomainError {
  readonly kind = 'not_found';
  readonly code = 'transaction-not-found';
  readonly title = 'Movement not found';

  constructor(id: string) {
    super(`Movement ${id} does not exist or you cannot see it.`);
  }
}

export class TransactionIdConflictError extends DomainError {
  readonly kind = 'conflict';
  readonly code = 'transaction-id-conflict';
  readonly title = 'Id already used';

  constructor(id: string) {
    super(`The id ${id} is already used by another movement.`);
  }
}

export class InvalidCursorError extends DomainError {
  readonly kind = 'invalid';
  readonly code = 'invalid-cursor';
  readonly title = 'Invalid page cursor';

  constructor() {
    super('The cursor is not valid. Start again from the first page.');
  }
}
