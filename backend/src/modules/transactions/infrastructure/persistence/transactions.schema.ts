import {
  bigint,
  boolean,
  date,
  index,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { usersTable } from '../../../auth/infrastructure/persistence/auth.schema.js';
import { categoriesTable } from '../../../categories/infrastructure/persistence/categories.schema.js';
import { householdsTable } from '../../../households/infrastructure/persistence/households.schema.js';
import type { TransactionType } from '../../domain/transaction.js';

export const transactionsTable = pgTable(
  'transactions',
  {
    id: uuid('id').primaryKey(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => householdsTable.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 8 }).$type<TransactionType>().notNull(),
    /** Cents (ADR-0007): BIGINT in the database, safe integer in JS. */
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    categoryId: varchar('category_id', { length: 36 })
      .notNull()
      .references(() => categoriesTable.id),
    description: varchar('description', { length: 140 }).notNull(),
    /** A calendar day: DATE, not TIMESTAMP (no time zone shifts). */
    occurredOn: date('occurred_on', { mode: 'string' }).notNull(),
    payerId: uuid('payer_id')
      .notNull()
      .references(() => usersTable.id),
    shared: boolean('shared').notNull(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => usersTable.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    // Serves the list (keyset pagination, newest first), the month summary and
    // the daily totals: all filter by household and a range of days.
    index('transactions_household_occurred_idx').on(
      table.householdId,
      table.occurredOn.desc(),
      table.createdAt.desc(),
      table.id.desc(),
    ),
  ],
);

export const transactionSharesTable = pgTable(
  'transaction_shares',
  {
    transactionId: uuid('transaction_id')
      .notNull()
      .references(() => transactionsTable.id, { onDelete: 'cascade' }),
    memberId: uuid('member_id')
      .notNull()
      .references(() => usersTable.id),
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.transactionId, table.memberId] }),
    // "Movements where I take part" and, in phase 5, balances per member.
    index('transaction_shares_member_id_idx').on(table.memberId),
  ],
);
