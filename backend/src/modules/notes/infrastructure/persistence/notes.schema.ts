import { pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

/** Table definition = source for `drizzle-kit generate` (migrations in backend/drizzle). */
export const notesTable = pgTable('notes', {
  id: uuid('id').primaryKey(),
  text: varchar('text', { length: 500 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
});

export type NoteRow = typeof notesTable.$inferSelect;
