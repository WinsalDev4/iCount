import { Injectable } from '@nestjs/common';
import { and, asc, desc, eq, isNull, or } from 'drizzle-orm';

import { DatabaseContext } from '../../../../shared/database/database-context.js';
import { type Category, CategoryRepository } from '../../domain/category.js';
import { categoriesTable } from './categories.schema.js';

@Injectable()
export class DrizzleCategoryRepository extends CategoryRepository {
  constructor(private readonly context: DatabaseContext) {
    super();
  }

  async listFor(householdId: string): Promise<Category[]> {
    return this.context.db
      .select(columns)
      .from(categoriesTable)
      .where(availableIn(householdId))
      .orderBy(
        desc(categoriesTable.isDefault),
        asc(categoriesTable.createdAt),
        asc(categoriesTable.name),
      );
  }

  async findAvailable(householdId: string, id: string): Promise<Category | null> {
    const [row] = await this.context.db
      .select(columns)
      .from(categoriesTable)
      .where(and(eq(categoriesTable.id, id), availableIn(householdId)))
      .limit(1);
    return row ?? null;
  }

  async create(category: Category): Promise<void> {
    await this.context.db.insert(categoriesTable).values(category);
  }
}

const columns = {
  id: categoriesTable.id,
  householdId: categoriesTable.householdId,
  name: categoriesTable.name,
  icon: categoriesTable.icon,
  kind: categoriesTable.kind,
  isDefault: categoriesTable.isDefault,
};

function availableIn(householdId: string) {
  return or(isNull(categoriesTable.householdId), eq(categoriesTable.householdId, householdId));
}
