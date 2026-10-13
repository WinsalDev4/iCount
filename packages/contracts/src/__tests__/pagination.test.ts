import { describe, expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod';

import { DEFAULT_PAGE_LIMIT, type Page, pageRequestSchema, pageSchema } from '../index.ts';

describe('pageRequestSchema', () => {
  it('uses the default limit and no cursor for the first page', () => {
    expect(pageRequestSchema.parse({})).toEqual({ limit: DEFAULT_PAGE_LIMIT });
  });

  it('coerces query string values', () => {
    expect(pageRequestSchema.parse({ cursor: 'abc', limit: '50' })).toEqual({
      cursor: 'abc',
      limit: 50,
    });
  });

  it.each([{ limit: '0' }, { limit: '101' }, { limit: '2.5' }, { limit: 'all' }, { cursor: '' }])(
    'rejects %j',
    (query) => {
      expect(pageRequestSchema.safeParse(query).success).toBe(false);
    },
  );
});

describe('pageSchema', () => {
  const itemSchema = z.object({ id: z.string() });
  const schema = pageSchema(itemSchema);

  it('parses a middle page and the last page', () => {
    expect(schema.parse({ items: [{ id: '1' }], nextCursor: 'next' }).nextCursor).toBe('next');
    expect(schema.parse({ items: [], nextCursor: null }).nextCursor).toBeNull();
  });

  it('validates every item and requires nextCursor', () => {
    expect(schema.safeParse({ items: [{ id: 1 }], nextCursor: null }).success).toBe(false);
    expect(schema.safeParse({ items: [] }).success).toBe(false);
  });

  it('infers a type assignable to Page<Item>', () => {
    expectTypeOf<z.infer<typeof schema>>().toExtend<Page<{ id: string }>>();
  });
});
