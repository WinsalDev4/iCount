import { Injectable } from '@nestjs/common';
import {
  and,
  asc,
  desc,
  eq,
  exists,
  gte,
  ilike,
  inArray,
  lte,
  or,
  type SQL,
  sql,
} from 'drizzle-orm';

import { DatabaseContext } from '../../../../shared/database/database-context.js';
import {
  type DayTotals,
  type ListCursor,
  type MonthTotals,
  type TransactionFilters,
  type TransactionPage,
  TransactionRepository,
} from '../../domain/transaction-repository.js';
import { Transaction } from '../../domain/transaction.js';
import { transactionSharesTable, transactionsTable } from './transactions.schema.js';

const t = transactionsTable;
const s = transactionSharesTable;

@Injectable()
export class DrizzleTransactionRepository extends TransactionRepository {
  constructor(private readonly context: DatabaseContext) {
    super();
  }

  async findById(id: string): Promise<Transaction | null> {
    const [row] = await this.context.db.select().from(t).where(eq(t.id, id)).limit(1);
    if (!row) return null;
    const [transaction] = await this.withShares([row]);
    return transaction ?? null;
  }

  save(transaction: Transaction): Promise<void> {
    return this.context.run(async () => {
      const db = this.context.db;
      const { shares, ...row } = transaction.snapshot;
      await db
        .insert(t)
        .values(row)
        .onConflictDoUpdate({
          target: t.id,
          set: {
            type: row.type,
            amountMinor: row.amountMinor,
            categoryId: row.categoryId,
            description: row.description,
            occurredOn: row.occurredOn,
            payerId: row.payerId,
            shared: row.shared,
            updatedAt: row.updatedAt,
          },
        });
      // Shares are derived data: replace them whole on every save.
      await db.delete(s).where(eq(s.transactionId, row.id));
      if (shares.length > 0) {
        await db.insert(s).values(shares.map((share) => ({ transactionId: row.id, ...share })));
      }
    });
  }

  async delete(id: string): Promise<void> {
    await this.context.db.delete(t).where(eq(t.id, id));
  }

  async list(
    householdId: string,
    filters: TransactionFilters,
    after: ListCursor | null,
    limit: number,
  ): Promise<TransactionPage> {
    const conditions: (SQL | undefined)[] = [
      eq(t.householdId, householdId),
      filters.type ? eq(t.type, filters.type) : undefined,
      filters.categoryId ? eq(t.categoryId, filters.categoryId) : undefined,
      filters.shared === undefined ? undefined : eq(t.shared, filters.shared),
      filters.from ? gte(t.occurredOn, filters.from) : undefined,
      filters.to ? lte(t.occurredOn, filters.to) : undefined,
      filters.query ? ilike(t.description, `%${escapeLike(filters.query)}%`) : undefined,
      filters.memberId
        ? or(
            eq(t.payerId, filters.memberId),
            exists(
              this.context.db
                .select({ one: sql`1` })
                .from(s)
                .where(and(eq(s.transactionId, t.id), eq(s.memberId, filters.memberId))),
            ),
          )
        : undefined,
      // Keyset: strictly after the last item of the previous page, in sort order.
      after
        ? sql`(${t.occurredOn}, ${t.createdAt}, ${t.id}) < (${after.occurredOn}::date, ${after.createdAt.toISOString()}::timestamptz, ${after.id}::uuid)`
        : undefined,
    ];

    // One extra row tells whether there is a next page, without a COUNT(*).
    const rows = await this.context.db
      .select()
      .from(t)
      .where(and(...conditions))
      .orderBy(desc(t.occurredOn), desc(t.createdAt), desc(t.id))
      .limit(limit + 1);

    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return {
      items: await this.withShares(page),
      next:
        rows.length > limit && last
          ? { occurredOn: last.occurredOn, createdAt: last.createdAt, id: last.id }
          : null,
    };
  }

  async totals(householdId: string, from: string, to: string): Promise<MonthTotals> {
    const inRange = and(
      eq(t.householdId, householdId),
      gte(t.occurredOn, from),
      lte(t.occurredOn, to),
    );
    const [sums] = await this.context.db
      .select({
        income: sumWhere(sql`${t.type} = 'income'`),
        expenses: sumWhere(sql`${t.type} = 'expense'`),
      })
      .from(t)
      .where(inRange);
    const byCategory = await this.context.db
      .select({ categoryId: t.categoryId, amountMinor: sumWhere(sql`true`) })
      .from(t)
      .where(and(inRange, eq(t.type, 'expense')))
      .groupBy(t.categoryId)
      .orderBy(desc(sumWhere(sql`true`)), asc(t.categoryId));

    return {
      incomeMinor: sums?.income ?? 0,
      expensesMinor: sums?.expenses ?? 0,
      expensesByCategory: byCategory,
    };
  }

  async dailyTotals(householdId: string, from: string, to: string): Promise<DayTotals[]> {
    return this.context.db
      .select({
        date: t.occurredOn,
        incomeMinor: sumWhere(sql`${t.type} = 'income'`),
        expensesMinor: sumWhere(sql`${t.type} = 'expense'`),
      })
      .from(t)
      .where(and(eq(t.householdId, householdId), gte(t.occurredOn, from), lte(t.occurredOn, to)))
      .groupBy(t.occurredOn)
      .orderBy(asc(t.occurredOn));
  }

  /** One query for every share of the page (no N+1). */
  private async withShares(rows: (typeof t.$inferSelect)[]): Promise<Transaction[]> {
    if (rows.length === 0) return [];
    const shares = await this.context.db
      .select()
      .from(s)
      .where(
        inArray(
          s.transactionId,
          rows.map((row) => row.id),
        ),
      );
    return rows.map((row) =>
      Transaction.restore({
        ...row,
        shares: shares
          .filter((share) => share.transactionId === row.id)
          .map((share) => ({ memberId: share.memberId, amountMinor: share.amountMinor })),
      }),
    );
  }
}

/** SUM of amounts matching a condition, as a JS number (cents fit in 2^53). */
function sumWhere(condition: SQL) {
  return sql<number>`coalesce(sum(case when ${condition} then ${t.amountMinor} else 0 end), 0)`.mapWith(
    Number,
  );
}

/** `%` and `_` typed by the user are literal characters, not wildcards. */
function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}
