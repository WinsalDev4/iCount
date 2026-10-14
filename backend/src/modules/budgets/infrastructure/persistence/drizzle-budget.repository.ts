import { Injectable } from '@nestjs/common';
import { and, asc, eq, type SQL, sql } from 'drizzle-orm';

import { DatabaseContext } from '../../../../shared/database/database-context.js';
import { transactionsTable } from '../../../transactions/infrastructure/persistence/transactions.schema.js';
import { type Budget, BudgetRepository, type BudgetWithSpending } from '../../domain/budget.js';
import { budgetsTable } from './budgets.schema.js';

const b = budgetsTable;
const t = transactionsTable;

/**
 * Spending is computed on read with a correlated sum over the month's expenses
 * of that category (served by the transactions household/date index), so it is
 * never stale: editing a movement updates every budget automatically.
 */
// Columns are qualified explicitly: inside a correlated subquery Drizzle would
// render them unqualified and `category_id = category_id` would match every row.
const spentMinor = sql<number>`(
  select coalesce(sum(tx.amount_minor), 0)
  from ${t} as tx
  where tx.household_id = "budgets"."household_id"
    and tx.category_id = "budgets"."category_id"
    and tx.type = 'expense'
    and tx.occurred_on >= to_date("budgets"."month" || '-01', 'YYYY-MM-DD')
    and tx.occurred_on < (to_date("budgets"."month" || '-01', 'YYYY-MM-DD') + interval '1 month')
)`.mapWith(Number);

@Injectable()
export class DrizzleBudgetRepository extends BudgetRepository {
  constructor(private readonly context: DatabaseContext) {
    super();
  }

  listForMonth(householdId: string, month: string): Promise<BudgetWithSpending[]> {
    return this.select(and(eq(b.householdId, householdId), eq(b.month, month))!);
  }

  async findById(id: string): Promise<BudgetWithSpending | null> {
    const [budget] = await this.select(eq(b.id, id));
    return budget ?? null;
  }

  async create(budget: Budget): Promise<boolean> {
    const inserted = await this.context.db
      .insert(b)
      .values(budget)
      .onConflictDoNothing({ target: [b.householdId, b.month, b.categoryId] })
      .returning({ id: b.id });
    return inserted.length === 1;
  }

  async updateLimit(id: string, limitMinor: number): Promise<void> {
    await this.context.db.update(b).set({ limitMinor }).where(eq(b.id, id));
  }

  async delete(id: string): Promise<void> {
    await this.context.db.delete(b).where(eq(b.id, id));
  }

  private select(where: SQL): Promise<BudgetWithSpending[]> {
    return this.context.db
      .select({
        id: b.id,
        householdId: b.householdId,
        categoryId: b.categoryId,
        month: b.month,
        limitMinor: b.limitMinor,
        currency: b.currency,
        createdAt: b.createdAt,
        spentMinor,
      })
      .from(b)
      .where(where)
      .orderBy(asc(b.createdAt));
  }
}
