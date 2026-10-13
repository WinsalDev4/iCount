import type { CategoryId } from '@/core/domain/Category';

/** What a category can classify. */
export type CategoryKind = 'expense' | 'income' | 'both';

export interface Category {
  readonly id: CategoryId;
  /** Display name (built-in names come localised from the API). */
  readonly name: string;
  /** Icon key of the app's icon set; unknown keys fall back to a generic icon. */
  readonly icon: string;
  readonly kind: CategoryKind;
  /** Built-in categories cannot be renamed or deleted. */
  readonly isDefault: boolean;
}

export interface NewCategory {
  readonly name: string;
  readonly icon: string;
  readonly kind: CategoryKind;
}
