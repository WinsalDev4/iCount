import { Injectable } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';

import { DatabaseContext } from '../../../../shared/database/database-context.js';
import { Debt, DebtRepository } from '../../domain/debt.js';
import { debtPaymentsTable, debtsTable } from './debts.schema.js';

const d = debtsTable;
const p = debtPaymentsTable;

@Injectable()
export class DrizzleDebtRepository extends DebtRepository {
  constructor(private readonly context: DatabaseContext) {
    super();
  }

  async listForHousehold(householdId: string): Promise<Debt[]> {
    const rows = await this.context.db
      .select()
      .from(d)
      .where(eq(d.householdId, householdId))
      .orderBy(asc(d.createdAt));
    return rows.map((row) => Debt.restore(row));
  }

  async findById(id: string): Promise<Debt | null> {
    const [row] = await this.context.db.select().from(d).where(eq(d.id, id)).limit(1);
    return row ? Debt.restore(row) : null;
  }

  async save(debt: Debt): Promise<void> {
    const row = debt.snapshot;
    await this.context.db
      .insert(d)
      .values(row)
      .onConflictDoUpdate({
        target: d.id,
        set: {
          name: row.name,
          kind: row.kind,
          annualRateBps: row.annualRateBps,
          aprBps: row.aprBps,
          monthlyPaymentMinor: row.monthlyPaymentMinor,
          termMonths: row.termMonths,
        },
      });
  }

  async delete(id: string): Promise<void> {
    await this.context.db.delete(d).where(eq(d.id, id));
  }

  async linkPayment(debtId: string, transactionId: string): Promise<boolean> {
    const inserted = await this.context.db
      .insert(p)
      .values({ debtId, transactionId })
      .onConflictDoNothing()
      .returning({ debtId: p.debtId });
    return inserted.length === 1;
  }

  async unlinkPayment(debtId: string, transactionId: string): Promise<void> {
    await this.context.db
      .delete(p)
      .where(and(eq(p.debtId, debtId), eq(p.transactionId, transactionId)));
  }

  async paymentTransactionIds(debtId: string): Promise<string[]> {
    const rows = await this.context.db
      .select({ id: p.transactionId })
      .from(p)
      .where(eq(p.debtId, debtId));
    return rows.map((row) => row.id);
  }
}
