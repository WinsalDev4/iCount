import type { Category, NewCategory } from './Category';

/**
 * Port for categories: built-in ones plus the household's custom ones.
 * Implementations: InMemory (pista B) and ApiCategoryRepository (A-3.2).
 */
export interface CategoryRepository {
  list(householdId: string): Promise<readonly Category[]>;
  create(householdId: string, input: NewCategory): Promise<Category>;
}
