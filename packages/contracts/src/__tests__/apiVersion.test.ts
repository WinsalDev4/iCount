import { describe, expect, it } from 'vitest';

import { API_VERSION, apiVersionSchema } from '../index.ts';

describe('apiVersionSchema', () => {
  it('accepts the current API version', () => {
    expect(apiVersionSchema.parse(API_VERSION)).toBe(1);
  });

  it('rejects any other version', () => {
    expect(apiVersionSchema.safeParse(2).success).toBe(false);
    expect(apiVersionSchema.safeParse('1').success).toBe(false);
  });
});
