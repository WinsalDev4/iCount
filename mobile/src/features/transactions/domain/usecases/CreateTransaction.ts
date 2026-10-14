import type { UserId } from '@/core/domain/Ids';
import type { Money } from '@/core/domain/Money';
import { uuidV4 } from '@/core/domain/uuid';

import type { CategoryId, NewTransaction, Transaction, TransactionType } from '../Transaction';
import { TransactionError } from '../TransactionError';
import type { TransactionRepository } from '../TransactionRepository';

export const MAX_DESCRIPTION_LENGTH = 80;

export interface CreateTransactionCommand {
  readonly householdId: string;
  readonly type: TransactionType;
  readonly amount: Money;
  readonly categoryId: CategoryId;
  readonly description?: string;
  /** Any moment of the day; stored as that calendar day. */
  readonly occurredAt: Date;
  /** Defaults to the signed-in member (the server decides). */
  readonly payerId?: UserId;
  readonly shared: boolean;
}

/**
 * Validates and creates a movement. The id is generated here (not by the server) so the list can
 * show it before the request ends and a retry after a timeout cannot duplicate it.
 */
export class CreateTransaction {
  constructor(
    private readonly repository: Pick<TransactionRepository, 'create'>,
    private readonly newId: () => string = defaultId,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** The movement as it will be sent (also what the optimistic list shows). */
  prepare(command: CreateTransactionCommand): NewTransaction {
    const description = (command.description ?? '').trim().replace(/\s+/g, ' ');

    if (command.amount.amountMinor <= 0) throw new TransactionError('invalid', 'amount');
    if (!command.categoryId) throw new TransactionError('invalid', 'category');
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      throw new TransactionError('invalid', 'description');
    }
    if (startOfDay(command.occurredAt) > startOfDay(this.now())) {
      throw new TransactionError('invalid', 'future-date');
    }

    return {
      id: this.newId(),
      householdId: command.householdId,
      type: command.type,
      amount: command.amount,
      categoryId: command.categoryId,
      description,
      occurredAt: startOfDay(command.occurredAt),
      payerId: command.payerId,
      shared: command.shared,
    };
  }

  /** Sends an already prepared movement. */
  send(input: NewTransaction): Promise<Transaction> {
    return this.repository.create(input);
  }

  async execute(command: CreateTransactionCommand): Promise<Transaction> {
    return this.send(this.prepare(command));
  }
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** The API only accepts UUIDs as client ids. */
function defaultId(): string {
  return uuidV4();
}

/**
 * The movement as the list should show it before the server answers. A shared movement has no
 * `shares` yet: the server computes them from the household's rule.
 */
export function toOptimisticTransaction(input: NewTransaction, me: UserId): Transaction {
  return {
    id: input.id ?? `optimistic-${Date.now()}`,
    type: input.type,
    amount: input.amount,
    categoryId: input.categoryId,
    description: input.description,
    occurredAt: input.occurredAt,
    householdId: input.householdId,
    payerId: input.payerId ?? me,
    shared: input.shared,
    shares: [],
  };
}
