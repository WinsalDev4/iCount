import { DomainError } from '../../../shared/domain/domain-error.js';

export type CategoryKind = 'expense' | 'income' | 'both';

/**
 * Built-in categories have a readable key as id (`food`) and no household;
 * custom ones a UUID and their household.
 */
export interface Category {
  readonly id: string;
  readonly householdId: string | null;
  readonly name: string;
  readonly icon: string;
  readonly kind: CategoryKind;
  readonly isDefault: boolean;
}

/** Whether a category can classify a movement of this type. */
export function acceptsType(category: Category, type: 'income' | 'expense'): boolean {
  return category.kind === 'both' || category.kind === type;
}

export class UnknownCategoryError extends DomainError {
  readonly kind = 'invalid';
  readonly code = 'unknown-category';
  readonly title = 'Unknown category';

  constructor(id: string) {
    super(`Category ${id} does not exist in this household.`);
  }
}

export class CategoryTypeMismatchError extends DomainError {
  readonly kind = 'invalid';
  readonly code = 'category-type-mismatch';
  readonly title = 'Category does not fit this movement';

  constructor(categoryId: string, type: string) {
    super(`Category ${categoryId} cannot be used for an ${type}.`);
  }
}

export abstract class CategoryRepository {
  /** Built-in categories first, then the household's own, by name. */
  abstract listFor(householdId: string): Promise<Category[]>;
  /** A built-in category or one of this household; null otherwise. */
  abstract findAvailable(householdId: string, id: string): Promise<Category | null>;
  abstract create(category: Category): Promise<void>;
}
