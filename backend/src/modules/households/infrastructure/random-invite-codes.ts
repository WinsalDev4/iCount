import { randomInt } from 'node:crypto';

import { INVITE_CODE_ALPHABET } from '@icount/contracts';

import { InviteCodeGenerator } from '../application/households.use-cases.js';

export const INVITE_CODE_LENGTH = 8;

/** Uniform random characters from the unambiguous alphabet (no 0/O, 1/I/L). */
export class RandomInviteCodes extends InviteCodeGenerator {
  generate(): string {
    let code = '';
    for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
      code += INVITE_CODE_ALPHABET[randomInt(INVITE_CODE_ALPHABET.length)];
    }
    return code;
  }
}
