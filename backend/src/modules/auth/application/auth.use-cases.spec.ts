import type { Clock } from '../../../shared/application/clock.js';
import type { IdGenerator } from '../../../shared/application/id-generator.js';
import type { EmailMessage, EmailSender } from '../../../shared/email/email-sender.js';
import {
  InvalidMagicLinkError,
  InvalidRefreshTokenError,
  RefreshTokenReusedError,
  TooManyMagicLinksError,
} from '../domain/auth.errors.js';
import type { MagicLink, MagicLinkRepository } from '../domain/magic-link.js';
import type { RefreshToken, RefreshTokenRepository } from '../domain/refresh-token.js';
import type { User, UserRepository } from '../domain/user.js';
import { Logout, RefreshSession, RequestMagicLink, VerifyMagicLink } from './auth.use-cases.js';
import type { AccessTokenIssuer, AuthSettings, SecureTokens } from './ports.js';
import { SessionIssuer } from './session-issuer.js';

class FakeMagicLinks implements MagicLinkRepository {
  readonly links: (MagicLink & { usedAt: Date | null })[] = [];
  async create(link: MagicLink) {
    this.links.push({ ...link, usedAt: null });
  }
  async countCreatedSince(email: string, since: Date) {
    return this.links.filter((l) => l.email === email && l.createdAt >= since).length;
  }
  async invalidatePending(email: string, now: Date) {
    for (const l of this.links) if (l.email === email && !l.usedAt) l.usedAt = now;
  }
  async consume(tokenHash: string, now: Date) {
    const link = this.links.find(
      (l) => l.tokenHash === tokenHash && !l.usedAt && l.expiresAt > now,
    );
    if (!link) return null;
    link.usedAt = now;
    return { email: link.email };
  }
}

class FakeUsers implements UserRepository {
  readonly users: User[] = [];
  async findById(id: string) {
    return this.users.find((u) => u.id === id) ?? null;
  }
  async findByEmail(email: string) {
    return this.users.find((u) => u.email === email) ?? null;
  }
  async register(user: User) {
    this.users.push(user);
    return user;
  }
}

class FakeRefreshTokens implements RefreshTokenRepository {
  readonly tokens: RefreshToken[] = [];
  async create(token: RefreshToken) {
    this.tokens.push(token);
  }
  async findByHash(tokenHash: string) {
    return this.tokens.find((t) => t.tokenHash === tokenHash) ?? null;
  }
  async markUsed(id: string, now: Date) {
    const index = this.tokens.findIndex((t) => t.id === id && !t.usedAt);
    if (index < 0) return false;
    this.tokens[index] = { ...this.tokens[index]!, usedAt: now };
    return true;
  }
  async revokeFamily(familyId: string, now: Date) {
    this.tokens.forEach((t, i) => {
      if (t.familyId === familyId) this.tokens[i] = { ...t, revokedAt: now };
    });
  }
}

const settings: AuthSettings = {
  magicLinkTtlMinutes: 15,
  magicLinkUrl: 'icount://auth/verify',
  refreshTokenTtlDays: 30,
  maxMagicLinksPerWindow: 3,
  magicLinkWindowMinutes: 15,
};

function setup() {
  let now = new Date('2026-10-14T10:00:00Z');
  let sequence = 0;
  const clock: Clock = { now: () => now };
  const ids: IdGenerator = { next: () => `id-${++sequence}` };
  const tokens: SecureTokens = { generate: () => `token-${++sequence}`, hash: (t) => `hash:${t}` };
  const access: AccessTokenIssuer = {
    issue: async (userId) => ({ token: `jwt-for-${userId}`, expiresAt: now }),
  };
  const sent: EmailMessage[] = [];
  const emails: EmailSender = { send: async (message) => void sent.push(message) };
  const magicLinks = new FakeMagicLinks();
  const users = new FakeUsers();
  const refreshTokens = new FakeRefreshTokens();
  const sessions = new SessionIssuer(refreshTokens, access, tokens, clock, ids, settings);

  return {
    advance: (minutes: number) => (now = new Date(now.getTime() + minutes * 60_000)),
    sent,
    magicLinks,
    users,
    refreshTokens,
    request: new RequestMagicLink(magicLinks, emails, tokens, clock, ids, settings),
    verify: new VerifyMagicLink(magicLinks, users, sessions, tokens, clock, ids),
    refresh: new RefreshSession(refreshTokens, users, sessions, tokens, clock),
    logout: new Logout(refreshTokens, tokens, clock),
    /** The token inside the last email's link, as the app would read it from the deep link. */
    lastLinkToken: () => /token=([^\s"&]+)/.exec(sent.at(-1)!.text)![1]!,
  };
}

describe('auth use cases', () => {
  it('emails a link and stores only the hash of its token', async () => {
    const auth = setup();

    await auth.request.execute('ana@icount.app');

    expect(auth.sent).toHaveLength(1);
    expect(auth.sent[0]!.to).toBe('ana@icount.app');
    const token = auth.lastLinkToken();
    expect(auth.sent[0]!.text).toContain(`icount://auth/verify?token=${token}`);
    expect(auth.magicLinks.links[0]!.tokenHash).toBe(`hash:${token}`);
  });

  it('signs up on the first verification and signs in afterwards', async () => {
    const auth = setup();

    await auth.request.execute('ana@icount.app');
    const first = await auth.verify.execute(auth.lastLinkToken());
    await auth.request.execute('ana@icount.app');
    const second = await auth.verify.execute(auth.lastLinkToken());

    expect(auth.users.users).toHaveLength(1);
    expect(second.user.id).toBe(first.user.id);
    expect(first.accessToken).toBe(`jwt-for-${first.user.id}`);
  });

  it('accepts each link once, only before it expires, and only the latest one', async () => {
    const auth = setup();

    await auth.request.execute('ana@icount.app');
    const superseded = auth.lastLinkToken();
    await auth.request.execute('ana@icount.app');
    const latest = auth.lastLinkToken();

    await expect(auth.verify.execute(superseded)).rejects.toThrow(InvalidMagicLinkError);
    await auth.verify.execute(latest);
    await expect(auth.verify.execute(latest)).rejects.toThrow(InvalidMagicLinkError);

    await auth.request.execute('leo@icount.app');
    const expiring = auth.lastLinkToken();
    auth.advance(15);
    await expect(auth.verify.execute(expiring)).rejects.toThrow(InvalidMagicLinkError);
  });

  it('limits links per email inside the window', async () => {
    const auth = setup();

    for (let i = 0; i < 3; i++) await auth.request.execute('ana@icount.app');
    await expect(auth.request.execute('ana@icount.app')).rejects.toThrow(TooManyMagicLinksError);
    await auth.request.execute('leo@icount.app');

    auth.advance(16);
    await expect(auth.request.execute('ana@icount.app')).resolves.toBeUndefined();
  });

  it('rotates refresh tokens and revokes the family when a used one comes back', async () => {
    const auth = setup();
    await auth.request.execute('ana@icount.app');
    const signIn = await auth.verify.execute(auth.lastLinkToken());

    const rotated = await auth.refresh.execute(signIn.refreshToken);
    expect(rotated.refreshToken).not.toBe(signIn.refreshToken);

    // An attacker replays the stolen first token: everything of that sign-in dies.
    await expect(auth.refresh.execute(signIn.refreshToken)).rejects.toThrow(
      RefreshTokenReusedError,
    );
    await expect(auth.refresh.execute(rotated.refreshToken)).rejects.toThrow(
      InvalidRefreshTokenError,
    );
  });

  it('rejects unknown and expired refresh tokens without revoking anything else', async () => {
    const auth = setup();
    await auth.request.execute('ana@icount.app');
    const signIn = await auth.verify.execute(auth.lastLinkToken());

    await expect(auth.refresh.execute('made-up')).rejects.toThrow(InvalidRefreshTokenError);
    auth.advance(30 * 24 * 60);
    await expect(auth.refresh.execute(signIn.refreshToken)).rejects.toThrow(
      InvalidRefreshTokenError,
    );
  });

  it('logs out by revoking the family, silently for unknown tokens', async () => {
    const auth = setup();
    await auth.request.execute('ana@icount.app');
    const signIn = await auth.verify.execute(auth.lastLinkToken());

    await auth.logout.execute(signIn.refreshToken);
    await auth.logout.execute('made-up');

    await expect(auth.refresh.execute(signIn.refreshToken)).rejects.toThrow(
      InvalidRefreshTokenError,
    );
  });
});
