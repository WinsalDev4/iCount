import type { Category, CategoryKind } from '../Category';
import type { CategoryRepository } from '../CategoryRepository';

/** Categories of a household, optionally only those that can classify an expense or an income. */
export class ListCategories {
  constructor(private readonly repository: CategoryRepository) {}

  async execute(
    householdId: string,
    only?: Exclude<CategoryKind, 'both'>,
  ): Promise<readonly Category[]> {
    const all = await this.repository.list(householdId);
    return only ? all.filter((c) => c.kind === only || c.kind === 'both') : all;
  }
}
