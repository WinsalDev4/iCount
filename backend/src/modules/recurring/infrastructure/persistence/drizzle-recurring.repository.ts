import { Injectable } from '@nestjs/common';
import { and, asc, eq, lte } from 'drizzle-orm';

import { DatabaseContext } from '../../../../shared/database/database-context.js';
import { RecurringPayment, RecurringPaymentRepository } from '../../domain/recurring-payment.js';
import { recurringOccurrencesTable, recurringPaymentsTable } from './recurring.schema.js';

const r = recurringPaymentsTable;

@Injectable()
export class DrizzleRecurringPaymentRepository extends RecurringPaymentRepository {
  constructor(private readonly context: DatabaseContext) {
    super();
  }

  async listForHousehold(householdId: string): Promise<RecurringPayment[]> {
    const rows = await this.context.db
      .select()
      .from(r)
      .where(eq(r.householdId, householdId))
      .orderBy(asc(r.nextDueDate), asc(r.name));
    return rows.map((row) => RecurringPayment.restore(row));
  }

  async findById(id: string): Promise<RecurringPayment | null> {
    const [row] = await this.context.db.select().from(r).where(eq(r.id, id)).limit(1);
    return row ? RecurringPayment.restore(row) : null;
  }

  async save(payment: RecurringPayment): Promise<void> {
    const { id: _id, householdId: _h, createdBy: _c, createdAt: _t, ...changes } = payment.snapshot;
    await this.context.db
      .insert(r)
      .values(payment.snapshot)
      .onConflictDoUpdate({ target: r.id, set: changes });
  }

  async delete(id: string): Promise<void> {
    await this.context.db.delete(r).where(eq(r.id, id));
  }

  async findDue(date: string): Promise<RecurringPayment[]> {
    const rows = await this.context.db.select().from(r).where(lte(r.nextDueDate, date));
    return rows.map((row) => RecurringPayment.restore(row));
  }

  async claimOccurrence(recurringPaymentId: string, dueDate: string): Promise<boolean> {
    const inserted = await this.context.db
      .insert(recurringOccurrencesTable)
      .values({ recurringPaymentId, dueDate, transactionId: null })
      .onConflictDoNothing()
      .returning({ dueDate: recurringOccurrencesTable.dueDate });
    return inserted.length === 1;
  }

  async linkOccurrence(
    recurringPaymentId: string,
    dueDate: string,
    transactionId: string,
  ): Promise<void> {
    await this.context.db
      .update(recurringOccurrencesTable)
      .set({ transactionId })
      .where(
        and(
          eq(recurringOccurrencesTable.recurringPaymentId, recurringPaymentId),
          eq(recurringOccurrencesTable.dueDate, dueDate),
        ),
      );
  }
}
