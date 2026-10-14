import type { CategoryId } from '@/core/domain/Category';
import { Money } from '@/core/domain/Money';
import type { YearMonth } from '@/core/domain/YearMonth';
import type { TransactionRepository } from '@/features/transactions/domain/TransactionRepository';

import type { Budget, NewBudget } from '../domain/Budget';
import { BudgetError } from '../domain/BudgetError';
import type { BudgetRepository } from '../domain/BudgetRepository';

/** What a budget stores; `spent` is NOT stored: it is read from the movements every time. */
interface StoredBudget {
  readonly id: string;
  readonly householdId: string;
  readonly categoryId: CategoryId;
  readonly month: YearMonth;
  readonly limit: Money;
}

export interface InMemoryBudgetOptions {
  /** Starting budgets. Giving them turns the demo data off unless `seedDemoData` says otherwise. */
  readonly budgets?: readonly StoredBudget[];
  /** Give each household a few budgets for the current month the first time it is asked (default). */
  readonly seedDemoData?: boolean;
  readonly now?: () => Date;
}

const sameMonth = (a: YearMonth, b: YearMonth) => a.year === b.year && a.month === b.month;

/**
 * Development/test adapter (`EXPO_PUBLIC_DATA_SOURCE=memory`). Like the API it derives `spent`
 * from the household's expenses of that category and month, so adding a movement moves the bars.
 */
export class InMemoryBudgetRepository implements BudgetRepository {
  private budgets: StoredBudget[];
  private sequence = 0;
  private readonly seeded = new Set<string>();
  private readonly seedDemoData: boolean;
  private readonly now: () => Date;

  constructor(
    private readonly transactions: Pick<TransactionRepository, 'findByMonth'>,
    options: InMemoryBudgetOptions = {},
  ) {
    this.budgets = [...(options.budgets ?? [])];
    this.seedDemoData = options.seedDemoData ?? options.budgets === undefined;
    this.now = options.now ?? (() => new Date());
  }

  async list(householdId: string, month: YearMonth): Promise<readonly Budget[]> {
    this.ensureSeeded(householdId);
    const stored = this.budgets.filter(
      (b) => b.householdId === householdId && sameMonth(b.month, month),
    );
    return this.withSpent(stored);
  }

  async create(input: NewBudget): Promise<Budget> {
    if (input.limit.amountMinor <= 0) throw new BudgetError('invalid');
    const duplicate = this.budgets.some(
      (b) =>
        b.householdId === input.householdId &&
        b.categoryId === input.categoryId &&
        sameMonth(b.month, input.month),
    );
    if (duplicate) throw new BudgetError('duplicate');

    this.sequence += 1;
    const stored: StoredBudget = { id: `budget-${this.sequence}`, ...input };
    this.budgets = [...this.budgets, stored];
    return (await this.withSpent([stored]))[0] as Budget;
  }

  async updateLimit(id: string, limit: Money): Promise<Budget> {
    const current = this.require(id);
    if (limit.amountMinor <= 0) throw new BudgetError('invalid');
    return this.replace({ ...current, limit });
  }

  async delete(id: string): Promise<void> {
    this.require(id);
    this.budgets = this.budgets.filter((b) => b.id !== id);
  }

  async moveAmount(
    fromId: string,
    toId: string,
    amount: Money,
  ): Promise<readonly [Budget, Budget]> {
    const from = this.require(fromId);
    const to = this.require(toId);
    if (
      from.householdId !== to.householdId ||
      !sameMonth(from.month, to.month) ||
      amount.amountMinor <= 0
    ) {
      throw new BudgetError('invalid');
    }

    // The source keeps at least what it has already spent: it cannot be "moved away" after the fact.
    const [fromWithSpent] = await this.withSpent([from]);
    const newFromLimit = from.limit.minus(amount);
    if (
      newFromLimit.amountMinor <= 0 ||
      newFromLimit.amountMinor < (fromWithSpent as Budget).spent.amountMinor
    ) {
      throw new BudgetError('insufficient-amount');
    }

    const [updatedFrom] = await this.withSpent([
      this.replaceStored({ ...from, limit: newFromLimit }),
    ]);
    const [updatedTo] = await this.withSpent([
      this.replaceStored({ ...to, limit: to.limit.plus(amount) }),
    ]);
    return [updatedFrom as Budget, updatedTo as Budget];
  }

  private ensureSeeded(householdId: string): void {
    if (!this.seedDemoData || this.seeded.has(householdId)) return;
    this.seeded.add(householdId);
    const today = this.now();
    const month = { year: today.getFullYear(), month: today.getMonth() + 1 };
    const demo: [string, number][] = [
      ['food', 30_000],
      ['leisure', 10_000],
      ['transport', 8_000],
    ];
    for (const [categoryId, limit] of demo) {
      this.sequence += 1;
      this.budgets.push({
        id: `budget-${this.sequence}`,
        householdId,
        categoryId: categoryId as CategoryId,
        month,
        limit: Money.ofMinor(limit, 'EUR'),
      });
    }
  }

  private async withSpent(stored: readonly StoredBudget[]): Promise<Budget[]> {
    const budgets: Budget[] = [];
    for (const b of stored) {
      const movements = await this.transactions.findByMonth(b.householdId, b.month);
      const spent = movements
        .filter((tx) => tx.type === 'expense' && tx.categoryId === b.categoryId)
        .reduce((sum, tx) => sum.plus(tx.amount), Money.zero(b.limit.currency));
      budgets.push({ ...b, spent, remaining: b.limit.minus(spent) });
    }
    return budgets;
  }

  private require(id: string): StoredBudget {
    const found = this.budgets.find((b) => b.id === id);
    if (!found) throw new BudgetError('not-found');
    return found;
  }

  private replaceStored(updated: StoredBudget): StoredBudget {
    this.budgets = this.budgets.map((b) => (b.id === updated.id ? updated : b));
    return updated;
  }

  private async replace(updated: StoredBudget): Promise<Budget> {
    return (await this.withSpent([this.replaceStored(updated)]))[0] as Budget;
  }
}
