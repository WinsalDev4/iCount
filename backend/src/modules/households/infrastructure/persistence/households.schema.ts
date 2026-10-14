import {
  bigint,
  index,
  jsonb,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { usersTable } from '../../../auth/infrastructure/persistence/auth.schema.js';
import type { HouseholdKind, MemberRole, SplitRule } from '../../domain/household.js';

export const householdsTable = pgTable('households', {
  id: uuid('id').primaryKey(),
  name: varchar('name', { length: 60 }).notNull(),
  kind: varchar('kind', { length: 16 }).$type<HouseholdKind>().notNull(),
  currency: varchar('currency', { length: 3 }).notNull(),
  /** Small, always read whole and validated by the contract: JSONB fits better than 3 tables. */
  splitRule: jsonb('split_rule').$type<SplitRule>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
});

export const householdMembersTable = pgTable(
  'household_members',
  {
    householdId: uuid('household_id')
      .notNull()
      .references(() => householdsTable.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 16 }).$type<MemberRole>().notNull(),
    /** Cents (ADR-0007); bigint column, read as a JS number (safe integers). */
    monthlyIncomeMinor: bigint('monthly_income_minor', { mode: 'number' }),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.householdId, table.userId] }),
    // "My households" looks members up by user.
    index('household_members_user_id_idx').on(table.userId),
  ],
);

export const householdInvitationsTable = pgTable('household_invitations', {
  id: uuid('id').primaryKey(),
  householdId: uuid('household_id')
    .notNull()
    .references(() => householdsTable.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 8 }).notNull().unique(),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => usersTable.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  usedBy: uuid('used_by').references(() => usersTable.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
});
