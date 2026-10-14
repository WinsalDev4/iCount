import { boolean, index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

import { householdsTable } from '../../../households/infrastructure/persistence/households.schema.js';
import type { CategoryKind } from '../../domain/category.js';

/**
 * One table for both kinds: built-in rows (seeded by migration 0004, `household_id`
 * NULL, readable key as id) and custom rows (UUID id, owned by a household).
 */
export const categoriesTable = pgTable(
  'categories',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    householdId: uuid('household_id').references(() => householdsTable.id, {
      onDelete: 'cascade',
    }),
    name: varchar('name', { length: 40 }).notNull(),
    icon: varchar('icon', { length: 40 }).notNull(),
    kind: varchar('kind', { length: 8 }).$type<CategoryKind>().notNull(),
    isDefault: boolean('is_default').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('categories_household_id_idx').on(table.householdId)],
);
