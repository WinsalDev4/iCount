import { bigint, pgTable, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';

import { categoriesTable } from '../../../categories/infrastructure/persistence/categories.schema.js';
import { householdsTable } from '../../../households/infrastructure/persistence/households.schema.js';

export const budgetsTable = pgTable(
  'budgets',
  {
    id: uuid('id').primaryKey(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => householdsTable.id, { onDelete: 'cascade' }),
    categoryId: varchar('category_id', { length: 36 })
      .notNull()
      .references(() => categoriesTable.id, { onDelete: 'cascade' }),
    /** `YYYY-MM`: a budget is for a calendar month. */
    month: varchar('month', { length: 7 }).notNull(),
    limitMinor: bigint('limit_minor', { mode: 'number' }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  // One budget per category and month; also the index for "budgets of a month".
  (table) => [
    unique('budgets_household_month_category_unique').on(
      table.householdId,
      table.month,
      table.categoryId,
    ),
  ],
);
