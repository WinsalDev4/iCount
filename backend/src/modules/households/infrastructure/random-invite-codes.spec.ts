import { inviteCodeSchema } from '@icount/contracts';

import { RandomInviteCodes } from './random-invite-codes.js';

describe('RandomInviteCodes', () => {
  it('generates codes the contract accepts, without look-alike characters', () => {
    const codes = Array.from({ length: 500 }, () => new RandomInviteCodes().generate());

    for (const code of codes) {
      expect(inviteCodeSchema.parse(code)).toBe(code);
      expect(code).not.toMatch(/[01ILO]/);
    }
    expect(new Set(codes).size).toBe(codes.length);
  });
});
