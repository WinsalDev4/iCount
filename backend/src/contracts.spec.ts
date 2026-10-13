import { API_VERSION, apiVersionSchema } from '@icount/contracts';

/** Proves the workspace package resolves and runs inside the backend toolchain. */
describe('@icount/contracts in the backend', () => {
  it('can be imported and validates with zod', () => {
    expect(apiVersionSchema.parse(API_VERSION)).toBe(1);
  });
});
