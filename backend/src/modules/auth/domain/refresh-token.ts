/**
 * Opaque, single-use refresh token (ADR-0013). Every sign-in starts a *family*;
 * each refresh marks the presented token as used and issues the next one in
 * the same family. Presenting a used token again means it was copied: the
 * whole family is revoked.
 */
export interface RefreshToken {
  readonly id: string;
  readonly familyId: string;
  readonly userId: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
  readonly createdAt: Date;
  readonly usedAt: Date | null;
  readonly revokedAt: Date | null;
}

export abstract class RefreshTokenRepository {
  abstract create(token: RefreshToken): Promise<void>;
  abstract findByHash(tokenHash: string): Promise<RefreshToken | null>;
  /** Atomically marks it as used; false if it had already been used (a reuse). */
  abstract markUsed(id: string, now: Date): Promise<boolean>;
  abstract revokeFamily(familyId: string, now: Date): Promise<void>;
}
