import { index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

import { usersTable } from '../../../auth/infrastructure/persistence/auth.schema.js';
import type { PushPlatform } from '../../domain/push.js';

/** One row per device. The token is the key: a device belongs to one account at a time. */
export const pushTokensTable = pgTable(
  'push_tokens',
  {
    token: varchar('token', { length: 255 }).primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    platform: varchar('platform', { length: 8 }).$type<PushPlatform>().notNull(),
    deviceName: varchar('device_name', { length: 80 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  (table) => [index('push_tokens_user_id_idx').on(table.userId)],
);

/** Tickets whose receipt has not been read yet (ADR-0017: clean up invalid tokens). */
export const pushTicketsTable = pgTable(
  'push_tickets',
  {
    receiptId: varchar('receipt_id', { length: 64 }).primaryKey(),
    token: varchar('token', { length: 255 }).notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull(),
  },
  (table) => [index('push_tickets_sent_at_idx').on(table.sentAt)],
);
