import { z } from 'zod';

/** Built-in categories. Mirrors `CategoryId` in mobile/src/features/transactions/domain. */
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

/** Strict: use it for what a client sends (requests). */
export const categoryIdSchema = z.enum(CATEGORY_IDS);

/**
 * Tolerant reader: use it for what a client receives (responses). An app built
 * before a new category existed maps it to `other` instead of failing.
 */
export const categoryIdResponseSchema = categoryIdSchema.catch('other');

export type CategoryId = z.infer<typeof categoryIdSchema>;
