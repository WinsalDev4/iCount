import {
  bigint,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { usersTable } from '../../../auth/infrastructure/persistence/auth.schema.js';
import { householdsTable } from '../../../households/infrastructure/persistence/households.schema.js';
import { transactionsTable } from '../../../transactions/infrastructure/persistence/transactions.schema.js';
import type { DebtKind } from '../../domain/debt.js';

export const debtsTable = pgTable(
  'debts',
  {
    id: uuid('id').primaryKey(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => householdsTable.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 60 }).notNull(),
    kind: varchar('kind', { length: 16 }).$type<DebtKind>().notNull(),
    principalMinor: bigint('principal_minor', { mode: 'number' }).notNull(),
    annualRateBps: integer('annual_rate_bps').notNull(),
    aprBps: integer('apr_bps'),
    monthlyPaymentMinor: bigint('monthly_payment_minor', { mode: 'number' }).notNull(),
    startDate: date('start_date', { mode: 'string' }).notNull(),
    termMonths: integer('term_months').notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => usersTable.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (table) => [index('debts_household_id_idx').on(table.householdId)],
);

/** Movements that paid a debt (manual links and instalments created by recurring payments). */
export const debtPaymentsTable = pgTable(
  'debt_payments',
  {
    debtId: uuid('debt_id')
      .notNull()
      .references(() => debtsTable.id, { onDelete: 'cascade' }),
    transactionId: uuid('transaction_id')
      .notNull()
      .references(() => transactionsTable.id, { onDelete: 'cascade' }),
    linkedAt: timestamp('linked_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.debtId, table.transactionId] })],
);
