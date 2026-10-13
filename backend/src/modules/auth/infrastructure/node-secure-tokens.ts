import { createHash, randomBytes } from 'node:crypto';

import { SecureTokens } from '../application/ports.js';

/**
 * 32 random bytes (256 bits) as base64url, hashed with SHA-256 for storage.
 * A fast hash is fine here (unlike passwords): the input is random and long,
 * so it cannot be brute-forced from the hash.
 */
export class NodeSecureTokens extends SecureTokens {
  generate(): string {
    return randomBytes(32).toString('base64url');
  }

  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
