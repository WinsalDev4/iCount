import { API_VERSION, apiVersionSchema } from '@icount/contracts';

/** Proves the workspace package resolves and runs inside the app's toolchain. */
describe('@icount/contracts in the app', () => {
  it('can be imported and validates with zod', () => {
    expect(apiVersionSchema.safeParse(API_VERSION).success).toBe(true);
  });
});
