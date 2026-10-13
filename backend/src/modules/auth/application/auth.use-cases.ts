import type { Clock } from '../../../shared/application/clock.js';
import type { IdGenerator } from '../../../shared/application/id-generator.js';
import type { EmailSender } from '../../../shared/email/email-sender.js';
import {
  InvalidMagicLinkError,
  InvalidRefreshTokenError,
  RefreshTokenReusedError,
  TooManyMagicLinksError,
} from '../domain/auth.errors.js';
import type { MagicLinkRepository } from '../domain/magic-link.js';
import type { RefreshTokenRepository } from '../domain/refresh-token.js';
import { User, type UserRepository } from '../domain/user.js';
import { magicLinkEmail } from './magic-link-email.js';
import type { AuthSettings, SecureTokens } from './ports.js';
import type { Session, SessionIssuer } from './session-issuer.js';

const MINUTE_MS = 60 * 1000;

/**
 * POST /auth/magic-link. Resolves the same way whether or not the account
 * exists, so the endpoint cannot be used to discover registered emails.
 */
export class RequestMagicLink {
  constructor(
    private readonly magicLinks: MagicLinkRepository,
    private readonly emails: EmailSender,
    private readonly tokens: SecureTokens,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly settings: AuthSettings,
  ) {}

  async execute(email: string): Promise<void> {
    const now = this.clock.now();
    const windowStart = new Date(now.getTime() - this.settings.magicLinkWindowMinutes * MINUTE_MS);
    const recent = await this.magicLinks.countCreatedSince(email, windowStart);
    if (recent >= this.settings.maxMagicLinksPerWindow) {
      throw new TooManyMagicLinksError(this.settings.magicLinkWindowMinutes);
    }

    await this.magicLinks.invalidatePending(email, now);
    const token = this.tokens.generate();
    await this.magicLinks.create({
      id: this.ids.next(),
      email,
      tokenHash: this.tokens.hash(token),
      expiresAt: new Date(now.getTime() + this.settings.magicLinkTtlMinutes * MINUTE_MS),
      createdAt: now,
    });

    const link = `${this.settings.magicLinkUrl}?token=${encodeURIComponent(token)}`;
    await this.emails.send(magicLinkEmail(email, link, this.settings.magicLinkTtlMinutes));
  }
}

/** POST /auth/verify: consumes the link and signs in, creating the account on first use. */
export class VerifyMagicLink {
  constructor(
    private readonly magicLinks: MagicLinkRepository,
    private readonly users: UserRepository,
    private readonly sessions: SessionIssuer,
    private readonly tokens: SecureTokens,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(token: string): Promise<Session> {
    const now = this.clock.now();
    const consumed = await this.magicLinks.consume(this.tokens.hash(token), now);
    if (!consumed) throw new InvalidMagicLinkError();

    const user =
      (await this.users.findByEmail(consumed.email)) ??
      (await this.users.register(
        User.register({ id: this.ids.next(), email: consumed.email, createdAt: now }),
      ));
    return this.sessions.start(user);
  }
}

/** POST /auth/refresh: rotates the refresh token, detecting reuse (ADR-0013). */
export class RefreshSession {
  constructor(
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly users: UserRepository,
    private readonly sessions: SessionIssuer,
    private readonly tokens: SecureTokens,
    private readonly clock: Clock,
  ) {}

  async execute(refreshToken: string): Promise<Session> {
    const now = this.clock.now();
    const record = await this.refreshTokens.findByHash(this.tokens.hash(refreshToken));
    if (!record || record.revokedAt) throw new InvalidRefreshTokenError();

    if (record.usedAt) return this.reuseDetected(record.familyId, now);
    if (record.expiresAt <= now) throw new InvalidRefreshTokenError();
    // Two refreshes racing with the same token: only one can mark it used.
    if (!(await this.refreshTokens.markUsed(record.id, now))) {
      return this.reuseDetected(record.familyId, now);
    }

    const user = await this.users.findById(record.userId);
    if (!user) throw new InvalidRefreshTokenError();
    return this.sessions.continue(user, record.familyId);
  }

  /** A used token came back: someone has a copy. Close every session of that sign-in. */
  private async reuseDetected(familyId: string, now: Date): Promise<never> {
    await this.refreshTokens.revokeFamily(familyId, now);
    throw new RefreshTokenReusedError();
  }
}

/** POST /auth/logout: revokes the session family. Idempotent and silent for unknown tokens. */
export class Logout {
  constructor(
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly tokens: SecureTokens,
    private readonly clock: Clock,
  ) {}

  async execute(refreshToken: string): Promise<void> {
    const record = await this.refreshTokens.findByHash(this.tokens.hash(refreshToken));
    if (record) await this.refreshTokens.revokeFamily(record.familyId, this.clock.now());
  }
}

/** GET /me */
export class GetCurrentUser {
  constructor(private readonly users: UserRepository) {}

  async execute(userId: string): Promise<User> {
    const user = await this.users.findById(userId);
    // A valid JWT for a deleted account: treat it as signed out.
    if (!user) throw new InvalidRefreshTokenError();
    return user;
  }
}
