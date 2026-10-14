import type { RecurrenceRule } from '@icount/finance';
import {
  bigint,
  boolean,
  date,
  index,
  jsonb,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { usersTable } from '../../../auth/infrastructure/persistence/auth.schema.js';
import { categoriesTable } from '../../../categories/infrastructure/persistence/categories.schema.js';
import { debtsTable } from '../../../debts/infrastructure/persistence/debts.schema.js';
import { householdsTable } from '../../../households/infrastructure/persistence/households.schema.js';
import { transactionsTable } from '../../../transactions/infrastructure/persistence/transactions.schema.js';
import type { RecurringKind } from '../../domain/recurring-payment.js';

export const recurringPaymentsTable = pgTable(
  'recurring_payments',
  {
    id: uuid('id').primaryKey(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => householdsTable.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 60 }).notNull(),
    kind: varchar('kind', { length: 16 }).$type<RecurringKind>().notNull(),
    type: varchar('type', { length: 8 }).$type<'income' | 'expense'>().notNull(),
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    categoryId: varchar('category_id', { length: 36 })
      .notNull()
      .references(() => categoriesTable.id),
    rule: jsonb('rule').$type<RecurrenceRule>().notNull(),
    startDate: date('start_date', { mode: 'string' }).notNull(),
    endDate: date('end_date', { mode: 'string' }),
    nextDueDate: date('next_due_date', { mode: 'string' }),
    payerId: uuid('payer_id')
      .notNull()
      .references(() => usersTable.id),
    shared: boolean('shared').notNull(),
    /** Loan instalment: each movement it creates is linked as a payment of the debt. */
    debtId: uuid('debt_id').references(() => debtsTable.id, { onDelete: 'set null' }),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => usersTable.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    // The daily job looks up everything due up to today.
    index('recurring_payments_next_due_date_idx').on(table.nextDueDate),
    index('recurring_payments_household_id_idx').on(table.householdId),
  ],
);

/**
 * One row per materialised occurrence. Its primary key is what makes the daily
 * job idempotent: the same (series, due date) can only become a movement once.
 */
export const recurringOccurrencesTable = pgTable(
  'recurring_occurrences',
  {
    recurringPaymentId: uuid('recurring_payment_id')
      .notNull()
      .references(() => recurringPaymentsTable.id, { onDelete: 'cascade' }),
    dueDate: date('due_date', { mode: 'string' }).notNull(),
    transactionId: uuid('transaction_id').references(() => transactionsTable.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.recurringPaymentId, table.dueDate] })],
);
