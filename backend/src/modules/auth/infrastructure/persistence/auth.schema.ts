import { index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const usersTable = pgTable('users', {
  id: uuid('id').primaryKey(),
  /** Normalised (lower case) by the contract; unique = one account per email. */
  email: varchar('email', { length: 254 }).notNull().unique(),
  displayName: varchar('display_name', { length: 60 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
});

export const magicLinksTable = pgTable(
  'magic_links',
  {
    id: uuid('id').primaryKey(),
    email: varchar('email', { length: 254 }).notNull(),
    /** SHA-256 hex of the token; the token itself is never stored. */
    tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  // Rate limiting and invalidation look links up by email and recency.
  (table) => [index('magic_links_email_created_at_idx').on(table.email, table.createdAt)],
);

export const refreshTokensTable = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey(),
    familyId: uuid('family_id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  // Revoking a family updates every token of it at once.
  (table) => [index('refresh_tokens_family_id_idx').on(table.familyId)],
);
