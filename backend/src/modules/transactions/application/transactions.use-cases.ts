import type { Clock } from '../../../shared/application/clock.js';
import type { IdGenerator } from '../../../shared/application/id-generator.js';
import type { TransactionRunner } from '../../../shared/application/transaction-runner.js';
import {
  acceptsType,
  CategoryTypeMismatchError,
  type CategoryRepository,
  UnknownCategoryError,
} from '../../categories/domain/category.js';
import type { HouseholdAccess } from '../../households/application/household-access.js';
import type { Household } from '../../households/domain/household.js';
import type {
  DayTotals,
  MonthTotals,
  TransactionFilters,
  TransactionRepository,
} from '../domain/transaction-repository.js';
import {
  type EditableFields,
  Transaction,
  TransactionIdConflictError,
  TransactionNotFoundError,
} from '../domain/transaction.js';
import { decodeCursor, encodeCursor } from './cursor.js';

export interface CreateTransactionInput extends Omit<EditableFields, 'payerId'> {
  /** Client-generated id: makes retries idempotent and optimistic rows stable. */
  readonly id?: string;
  readonly payerId?: string;
  readonly currency: string;
}

/** Loads a movement only for members of its household (404 otherwise). */
async function loadForMember(
  transactions: TransactionRepository,
  access: HouseholdAccess,
  id: string,
  actorId: string,
): Promise<{ transaction: Transaction; household: Household }> {
  const transaction = await transactions.findById(id);
  if (!transaction) throw new TransactionNotFoundError(id);
  try {
    const household = await access.requireMember(transaction.householdId, actorId);
    return { transaction, household };
  } catch {
    throw new TransactionNotFoundError(id);
  }
}

async function assertCategory(
  categories: CategoryRepository,
  householdId: string,
  categoryId: string,
  type: 'income' | 'expense',
): Promise<void> {
  const category = await categories.findAvailable(householdId, categoryId);
  if (!category) throw new UnknownCategoryError(categoryId);
  if (!acceptsType(category, type)) throw new CategoryTypeMismatchError(categoryId, type);
}

export class CreateTransaction {
  constructor(
    private readonly access: HouseholdAccess,
    private readonly transactions: TransactionRepository,
    private readonly categories: CategoryRepository,
    private readonly runner: TransactionRunner,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  /** Returns the movement and whether it was created now (false = idempotent replay). */
  execute(
    actorId: string,
    householdId: string,
    input: CreateTransactionInput,
  ): Promise<{ transaction: Transaction; created: boolean }> {
    return this.runner.run(async () => {
      const household = await this.access.requireMember(householdId, actorId);

      if (input.id) {
        const existing = await this.transactions.findById(input.id);
        if (existing) {
          // Same request retried (e.g. after a timeout): answer with what was stored.
          if (existing.householdId === householdId && existing.snapshot.createdBy === actorId) {
            return { transaction: existing, created: false };
          }
          throw new TransactionIdConflictError(input.id);
        }
      }

      await assertCategory(this.categories, householdId, input.categoryId, input.type);
      const transaction = Transaction.create(household, {
        ...input,
        id: input.id ?? this.ids.next(),
        payerId: input.payerId ?? actorId,
        createdBy: actorId,
        now: this.clock.now(),
      });
      await this.transactions.save(transaction);
      return { transaction, created: true };
    });
  }
}

export class GetTransaction {
  constructor(
    private readonly access: HouseholdAccess,
    private readonly transactions: TransactionRepository,
  ) {}

  async execute(actorId: string, id: string): Promise<Transaction> {
    return (await loadForMember(this.transactions, this.access, id, actorId)).transaction;
  }
}

export class UpdateTransaction {
  constructor(
    private readonly access: HouseholdAccess,
    private readonly transactions: TransactionRepository,
    private readonly categories: CategoryRepository,
    private readonly runner: TransactionRunner,
    private readonly clock: Clock,
  ) {}

  execute(
    actorId: string,
    id: string,
    changes: Partial<EditableFields> & { currency?: string },
  ): Promise<Transaction> {
    return this.runner.run(async () => {
      const { transaction, household } = await loadForMember(
        this.transactions,
        this.access,
        id,
        actorId,
      );
      const next = { ...transaction.snapshot, ...changes };
      if (changes.categoryId !== undefined || changes.type !== undefined) {
        await assertCategory(this.categories, household.id, next.categoryId, next.type);
      }
      transaction.edit(household, changes, this.clock.now());
      await this.transactions.save(transaction);
      return transaction;
    });
  }
}

export class DeleteTransaction {
  constructor(
    private readonly access: HouseholdAccess,
    private readonly transactions: TransactionRepository,
  ) {}

  async execute(actorId: string, id: string): Promise<void> {
    await loadForMember(this.transactions, this.access, id, actorId);
    await this.transactions.delete(id);
  }
}

export class ListTransactions {
  constructor(
    private readonly access: HouseholdAccess,
    private readonly transactions: TransactionRepository,
  ) {}

  async execute(
    actorId: string,
    householdId: string,
    filters: TransactionFilters,
    page: { cursor?: string; limit: number },
  ): Promise<{ items: Transaction[]; nextCursor: string | null }> {
    await this.access.requireMember(householdId, actorId);
    const after = page.cursor ? decodeCursor(page.cursor) : null;
    const result = await this.transactions.list(householdId, filters, after, page.limit);
    return { items: result.items, nextCursor: result.next ? encodeCursor(result.next) : null };
  }
}

/** First and last day of a `YYYY-MM` month, as calendar dates. */
export function monthRange(month: string): { from: string; to: string } {
  const [year, monthNumber] = month.split('-').map(Number) as [number, number];
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, '0')}` };
}

export class GetMonthlySummary {
  constructor(
    private readonly access: HouseholdAccess,
    private readonly transactions: TransactionRepository,
  ) {}

  async execute(
    actorId: string,
    householdId: string,
    month: string,
  ): Promise<MonthTotals & { currency: string }> {
    const household = await this.access.requireMember(householdId, actorId);
    const { from, to } = monthRange(month);
    return {
      ...(await this.transactions.totals(householdId, from, to)),
      currency: household.currency,
    };
  }
}

export class GetDailyTotals {
  constructor(
    private readonly access: HouseholdAccess,
    private readonly transactions: TransactionRepository,
  ) {}

  async execute(
    actorId: string,
    householdId: string,
    month: string,
  ): Promise<{ days: DayTotals[]; currency: string }> {
    const household = await this.access.requireMember(householdId, actorId);
    const { from, to } = monthRange(month);
    return {
      days: await this.transactions.dailyTotals(householdId, from, to),
      currency: household.currency,
    };
  }
}
