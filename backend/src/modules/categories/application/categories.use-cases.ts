import type { IdGenerator } from '../../../shared/application/id-generator.js';
import type { HouseholdAccess } from '../../households/application/household-access.js';
import type { Category, CategoryKind, CategoryRepository } from '../domain/category.js';

export class ListCategories {
  constructor(
    private readonly access: HouseholdAccess,
    private readonly categories: CategoryRepository,
  ) {}

  async execute(actorId: string, householdId: string): Promise<Category[]> {
    await this.access.requireMember(householdId, actorId);
    return this.categories.listFor(householdId);
  }
}

export class CreateCategory {
  constructor(
    private readonly access: HouseholdAccess,
    private readonly categories: CategoryRepository,
    private readonly ids: IdGenerator,
  ) {}

  async execute(
    actorId: string,
    householdId: string,
    input: { name: string; icon: string; kind: CategoryKind },
  ): Promise<Category> {
    await this.access.requireMember(householdId, actorId);
    const category: Category = {
      id: this.ids.next(),
      householdId,
      ...input,
      isDefault: false,
    };
    await this.categories.create(category);
    return category;
  }
}
