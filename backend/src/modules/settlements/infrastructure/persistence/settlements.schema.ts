import { bigint, date, index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

import { usersTable } from '../../../auth/infrastructure/persistence/auth.schema.js';
import { householdsTable } from '../../../households/infrastructure/persistence/households.schema.js';
import type { SettlementMethod } from '../../domain/settlement.js';

export const settlementsTable = pgTable(
  'settlements',
  {
    id: uuid('id').primaryKey(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => householdsTable.id, { onDelete: 'cascade' }),
    fromMemberId: uuid('from_member_id')
      .notNull()
      .references(() => usersTable.id),
    toMemberId: uuid('to_member_id')
      .notNull()
      .references(() => usersTable.id),
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    method: varchar('method', { length: 16 }).$type<SettlementMethod>().notNull(),
    note: varchar('note', { length: 140 }).notNull(),
    settledOn: date('settled_on', { mode: 'string' }).notNull(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => usersTable.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (table) => [index('settlements_household_settled_idx').on(table.householdId, table.settledOn)],
);
