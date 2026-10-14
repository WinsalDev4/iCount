/** Random opaque tokens and their one-way hash (stored instead of the token). */
export abstract class SecureTokens {
  /** Unguessable token (≥ 256 bits), URL-safe. */
  abstract generate(): string;
  abstract hash(token: string): string;
}

/** Issues the short-lived access JWT (implemented by shared AccessTokenService). */
export abstract class AccessTokenIssuer {
  abstract issue(userId: string): Promise<{ token: string; expiresAt: Date }>;
}

/** Tunables of the auth flows, from AppConfig (ADR-0013). */
export abstract class AuthSettings {
  abstract readonly magicLinkTtlMinutes: number;
  abstract readonly magicLinkUrl: string;
  abstract readonly refreshTokenTtlDays: number;
  /** At most this many links per email inside `magicLinkWindowMinutes`. */
  abstract readonly maxMagicLinksPerWindow: number;
  abstract readonly magicLinkWindowMinutes: number;
}
