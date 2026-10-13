import { z } from 'zod';

import { householdIdSchema } from './ids.ts';

/** Built-in categories (seeded in Spanish by the API). Mirrors `BuiltInCategoryId` in the app. */
export const CATEGORY_IDS = [
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

/** Built-in category key. Strict: use it for what a client sends (requests). */
export const categoryIdSchema = z.enum(CATEGORY_IDS);

/**
 * Tolerant reader: use it for what a client receives (responses). An app built
 * before a new category existed maps it to `other` instead of failing.
 */
export const categoryIdResponseSchema = categoryIdSchema.catch('other');

/** Categories a household creates itself are identified by a UUID. */
export const customCategoryIdSchema = z.uuid().brand<'CustomCategoryId'>();

/** Any category: a built-in key (`food`) or a custom category id (UUID). For requests. */
export const categoryRefSchema = z.union([categoryIdSchema, customCategoryIdSchema]);

/** Tolerant version for responses: unknown built-in keys read as `other`. */
export const categoryRefResponseSchema = categoryRefSchema.catch('other');

/** What a category can classify. */
export const categoryKindSchema = z.enum(['expense', 'income', 'both']);

/**
 * Icon key from the app's icon set (e.g. `cart`, `home`). Unknown keys are kept
 * as strings so the app can fall back to a generic icon.
 */
export const categoryIconSchema = z.string().min(1).max(40);

export const categoryDtoSchema = z.object({
  id: categoryRefResponseSchema,
  /** Display name, already localised by the API for built-in categories. */
  name: z.string().min(1).max(40),
  icon: categoryIconSchema,
  kind: categoryKindSchema,
  /** Built-in (seeded) categories cannot be renamed or deleted. */
  isDefault: z.boolean(),
  /** Null for built-in categories. */
  householdId: householdIdSchema.nullable(),
});

/** POST /v1/households/:id/categories → CategoryDto. */
export const createCategoryRequestSchema = z.object({
  name: z.string().trim().min(1).max(40),
  icon: categoryIconSchema,
  kind: categoryKindSchema,
});

export type CategoryId = z.infer<typeof categoryIdSchema>;
export type CustomCategoryId = z.infer<typeof customCategoryIdSchema>;
export type CategoryRef = z.infer<typeof categoryRefSchema>;
export type CategoryKind = z.infer<typeof categoryKindSchema>;
export type CategoryDto = z.infer<typeof categoryDtoSchema>;
export type CreateCategoryRequest = z.infer<typeof createCategoryRequestSchema>;
