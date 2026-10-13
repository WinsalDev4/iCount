import { z } from 'zod';

export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;

/**
 * Cursor pagination request (query string, so values arrive as strings).
 * The cursor is opaque: clients send back what the server returned, never build it.
 */
export const pageRequestSchema = z.object({
  cursor: z.string().min(1).max(512).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(DEFAULT_PAGE_LIMIT),
});

export type PageRequest = z.infer<typeof pageRequestSchema>;

/** Generic page of results: `pageSchema(transactionSchema)`. `nextCursor: null` = last page. */
export function pageSchema<Item extends z.ZodType>(item: Item) {
  return z.object({
    items: z.array(item),
    nextCursor: z.string().min(1).nullable(),
  });
}

export interface Page<Item> {
  readonly items: readonly Item[];
  readonly nextCursor: string | null;
}
