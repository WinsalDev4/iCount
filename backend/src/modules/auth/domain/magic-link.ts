/**
 * A single-use sign-in link (ADR-0013). Only the SHA-256 hash of the token is
 * stored: a database leak does not let anyone sign in.
 */
export interface MagicLink {
  readonly id: string;
  readonly email: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
  readonly createdAt: Date;
}

export abstract class MagicLinkRepository {
  abstract create(link: MagicLink): Promise<void>;
  /** How many links were requested for this email since `since` (rate limiting). */
  abstract countCreatedSince(email: string, since: Date): Promise<number>;
  /** Makes every pending link of this email unusable (a new one supersedes them). */
  abstract invalidatePending(email: string, now: Date): Promise<void>;
  /**
   * Atomically marks a pending, unexpired link as used and returns its email.
   * Null when the token is unknown, already used, superseded or expired.
   */
  abstract consume(tokenHash: string, now: Date): Promise<{ email: string } | null>;
}
