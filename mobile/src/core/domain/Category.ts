/**
 * Categories are shared by several features (transactions, household split
 * rules, budgets). Mirrors `categoryRefSchema` in @icount/contracts.
 */
export const BUILT_IN_CATEGORY_IDS = [
  'food',
  'bills',
  'housing',
  'transport',
  'loans',
  'insurance',
  'leisure',
  'salary',
  'other',
] as const;

/** Categories every household has (seeded by the API). */
export type BuiltInCategoryId = (typeof BUILT_IN_CATEGORY_IDS)[number];

/** Categories a household creates itself (UUID from the API). */
export type CustomCategoryId = string & { readonly __brand: 'CustomCategoryId' };

export type CategoryId = BuiltInCategoryId | CustomCategoryId;

export function isBuiltInCategory(id: CategoryId): id is BuiltInCategoryId {
  return (BUILT_IN_CATEGORY_IDS as readonly string[]).includes(id);
}
