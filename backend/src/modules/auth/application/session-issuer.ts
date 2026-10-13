import type { Clock } from '../../../shared/application/clock.js';
import type { IdGenerator } from '../../../shared/application/id-generator.js';
import type { RefreshTokenRepository } from '../domain/refresh-token.js';
import type { User } from '../domain/user.js';
import type { AccessTokenIssuer, AuthSettings, SecureTokens } from './ports.js';

/** What a successful sign-in or refresh returns. */
export interface Session {
  readonly user: User;
  readonly accessToken: string;
  readonly accessTokenExpiresAt: Date;
  /** Plain refresh token: shown to the client once, only its hash is stored. */
  readonly refreshToken: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Issues the access + refresh token pair, starting or continuing a refresh family. */
export class SessionIssuer {
  constructor(
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly accessTokens: AccessTokenIssuer,
    private readonly tokens: SecureTokens,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly settings: AuthSettings,
  ) {}

  /** New sign-in: a new refresh family. */
  start(user: User): Promise<Session> {
    return this.issue(user, this.ids.next());
  }

  /** Refresh: next token of the same family (the previous one is already marked used). */
  continue(user: User, familyId: string): Promise<Session> {
    return this.issue(user, familyId);
  }

  private async issue(user: User, familyId: string): Promise<Session> {
    const now = this.clock.now();
    const refreshToken = this.tokens.generate();
    await this.refreshTokens.create({
      id: this.ids.next(),
      familyId,
      userId: user.id,
      tokenHash: this.tokens.hash(refreshToken),
      expiresAt: new Date(now.getTime() + this.settings.refreshTokenTtlDays * DAY_MS),
      createdAt: now,
      usedAt: null,
      revokedAt: null,
    });
    const access = await this.accessTokens.issue(user.id);
    return {
      user,
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt,
      refreshToken,
    };
  }
}
