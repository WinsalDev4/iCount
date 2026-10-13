import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { APP_CONFIG, type AppConfig } from '../config/app-config.js';
import type { AuthenticatedUser } from './authenticated-user.js';

export interface IssuedAccessToken {
  readonly token: string;
  readonly expiresAt: Date;
}

/**
 * Short-lived JWT (HS256, 15 min, ADR-0013). Stateless: verifying it needs no
 * database, which is why it must stay short-lived (it cannot be revoked).
 */
@Injectable()
export class AccessTokenService {
  constructor(
    private readonly jwt: JwtService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async issue(userId: string): Promise<IssuedAccessToken> {
    const ttl = this.config.auth.accessTokenTtlSeconds;
    const token = await this.jwt.signAsync({ sub: userId, typ: 'access' }, { expiresIn: ttl });
    return { token, expiresAt: new Date(Date.now() + ttl * 1000) };
  }

  /** Null for anything that is not a valid, unexpired access token of this API. */
  async verify(token: string): Promise<AuthenticatedUser | null> {
    try {
      const payload = await this.jwt.verifyAsync<{ sub?: unknown; typ?: unknown }>(token);
      if (typeof payload.sub !== 'string' || payload.typ !== 'access') return null;
      return { userId: payload.sub };
    } catch {
      return null;
    }
  }
}
