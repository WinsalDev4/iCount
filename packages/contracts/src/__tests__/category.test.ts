import { describe, expect, it } from 'vitest';

import { categoryIdResponseSchema, categoryIdSchema } from '../index.ts';

describe('category ids', () => {
  it('accepts the built-in categories', () => {
    expect(categoryIdSchema.parse('food')).toBe('food');
    expect(categoryIdSchema.options).toContain('insurance');
  });

  it('is strict for requests', () => {
    expect(categoryIdSchema.safeParse('pets').success).toBe(false);
  });

  it('is tolerant for responses: unknown categories become other', () => {
    expect(categoryIdResponseSchema.parse('pets')).toBe('other');
    expect(categoryIdResponseSchema.parse('food')).toBe('food');
  });
});
