import type { CategoryId, CustomCategoryId } from '@/core/domain/Category';

import type { Category, NewCategory } from '../domain/Category';
import type { CategoryRepository } from '../domain/CategoryRepository';

/** The categories every household starts with (the API seeds the same ones, localised). */
export const BUILT_IN_CATEGORIES: readonly Category[] = [
  { id: 'food', name: 'Comida', icon: 'cart', kind: 'expense', isDefault: true },
  { id: 'bills', name: 'Facturas', icon: 'receipt', kind: 'expense', isDefault: true },
  { id: 'housing', name: 'Vivienda', icon: 'home', kind: 'expense', isDefault: true },
  { id: 'transport', name: 'Transporte', icon: 'car', kind: 'expense', isDefault: true },
  { id: 'loans', name: 'Préstamos', icon: 'bank', kind: 'expense', isDefault: true },
  { id: 'insurance', name: 'Seguros', icon: 'shield', kind: 'expense', isDefault: true },
  { id: 'leisure', name: 'Ocio', icon: 'popcorn', kind: 'expense', isDefault: true },
  { id: 'salary', name: 'Nómina', icon: 'wallet', kind: 'income', isDefault: true },
  { id: 'other', name: 'Otros', icon: 'dots', kind: 'both', isDefault: true },
] as const;

/** Development/test adapter: built-ins for everyone, plus the custom ones created in this run. */
export class InMemoryCategoryRepository implements CategoryRepository {
  private readonly custom = new Map<string, Category[]>();
  private sequence = 0;

  async list(householdId: string): Promise<readonly Category[]> {
    return [...BUILT_IN_CATEGORIES, ...(this.custom.get(householdId) ?? [])];
  }

  async create(householdId: string, input: NewCategory): Promise<Category> {
    this.sequence += 1;
    const category: Category = {
      id: `custom-${this.sequence}` as CustomCategoryId as CategoryId,
      name: input.name.trim(),
      icon: input.icon,
      kind: input.kind,
      isDefault: false,
    };
    this.custom.set(householdId, [...(this.custom.get(householdId) ?? []), category]);
    return category;
  }
}
