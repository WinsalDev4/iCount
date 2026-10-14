import { bigint, index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

import { usersTable } from '../../../auth/infrastructure/persistence/auth.schema.js';
import { householdsTable } from '../../../households/infrastructure/persistence/households.schema.js';
import { transactionsTable } from '../../../transactions/infrastructure/persistence/transactions.schema.js';
import type { ActivityType } from '../../domain/activity.js';

/**
 * Append-only feed of each household. `transaction_id` and `settlement_id` have
 * no foreign key on purpose: "Ana deleted «Luz»" must outlive the movement.
 */
export const activitiesTable = pgTable(
  'activities',
  {
    id: uuid('id').primaryKey(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => householdsTable.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 32 }).$type<ActivityType>().notNull(),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => usersTable.id),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    transactionId: uuid('transaction_id'),
    settlementId: uuid('settlement_id'),
    amountMinor: bigint('amount_minor', { mode: 'number' }),
    currency: varchar('currency', { length: 3 }),
    description: varchar('description', { length: 140 }),
  },
  (table) => [
    // The feed: household, newest first (keyset pagination).
    index('activities_household_occurred_idx').on(
      table.householdId,
      table.occurredAt.desc(),
      table.id.desc(),
    ),
    index('activities_transaction_id_idx').on(table.transactionId),
  ],
);

export const commentsTable = pgTable(
  'comments',
  {
    id: uuid('id').primaryKey(),
    transactionId: uuid('transaction_id')
      .notNull()
      .references(() => transactionsTable.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => usersTable.id),
    body: varchar('body', { length: 500 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (table) => [index('comments_transaction_id_idx').on(table.transactionId, table.createdAt)],
);
