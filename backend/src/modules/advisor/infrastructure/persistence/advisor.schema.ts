import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { usersTable } from '../../../auth/infrastructure/persistence/auth.schema.js';
import { householdsTable } from '../../../households/infrastructure/persistence/households.schema.js';
import type { InsightsReport, Plan } from '../../domain/advisor.js';
import type { AdvisorAction } from '../../domain/findings.js';

/** Versioned consent per user (ADR-0020): nothing goes to the model without it. */
export const advisorConsentsTable = pgTable('advisor_consents', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => usersTable.id, { onDelete: 'cascade' }),
  granted: boolean('granted').notNull(),
  version: integer('version').notNull(),
  grantedAt: timestamp('granted_at', { withTimezone: true }),
});

/** Last insights report per household, reused while its findings do not change. */
export const advisorReportsTable = pgTable('advisor_reports', {
  householdId: uuid('household_id')
    .primaryKey()
    .references(() => householdsTable.id, { onDelete: 'cascade' }),
  fingerprint: varchar('fingerprint', { length: 80 }).notNull(),
  report: jsonb('report').$type<SerializedReport>().notNull(),
  generatedAt: timestamp('generated_at', { withTimezone: true }).notNull(),
});

export type SerializedReport = Omit<InsightsReport, 'generatedAt'>;

export const advisorConversationsTable = pgTable(
  'advisor_conversations',
  {
    id: uuid('id').primaryKey(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => householdsTable.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    /** Retention (30 days) counts from the last message. */
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    index('advisor_conversations_user_idx').on(table.userId),
    index('advisor_conversations_last_message_idx').on(table.lastMessageAt),
  ],
);

export const advisorMessagesTable = pgTable(
  'advisor_messages',
  {
    id: uuid('id').primaryKey(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => advisorConversationsTable.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 9 }).$type<'user' | 'assistant'>().notNull(),
    content: text('content').notNull(),
    plan: jsonb('plan').$type<Plan>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (table) => [index('advisor_messages_conversation_idx').on(table.conversationId, table.createdAt)],
);

/** What users applied from insights and plans: the evaluation signal of the advisor. */
export const advisorAppliedActionsTable = pgTable('advisor_applied_actions', {
  id: uuid('id').primaryKey(),
  householdId: uuid('household_id')
    .notNull()
    .references(() => householdsTable.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => usersTable.id, { onDelete: 'cascade' }),
  insightId: uuid('insight_id'),
  planId: uuid('plan_id'),
  action: jsonb('action').$type<AdvisorAction>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
});
