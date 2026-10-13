import { describe, expect, expectTypeOf, it } from 'vitest';

import { type HouseholdId, householdIdSchema, type UserId, userIdSchema } from '../index.ts';

const uuid = '0199e0a4-5b2c-7c3d-9e4f-123456789abc';

describe('branded ids', () => {
  it('accept UUIDs and return them unchanged at runtime', () => {
    expect(userIdSchema.parse(uuid)).toBe(uuid);
  });

  it.each(['', 'user-1', '0199e0a4-5b2c-7c3d-9e4f'])('reject %j', (value) => {
    expect(userIdSchema.safeParse(value).success).toBe(false);
  });

  it('are different types for the compiler', () => {
    const userId = userIdSchema.parse(uuid);
    expectTypeOf(userId).toEqualTypeOf<UserId>();
    expectTypeOf(householdIdSchema.parse(uuid)).not.toEqualTypeOf<UserId>();

    const needsHousehold = (id: HouseholdId) => id;
    // @ts-expect-error a UserId is not a HouseholdId
    needsHousehold(userId);
    // @ts-expect-error a plain string is not a branded id
    needsHousehold(uuid);
  });
});
