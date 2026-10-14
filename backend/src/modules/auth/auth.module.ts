import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';

import { Clock } from '../../shared/application/clock.js';
import { IdGenerator } from '../../shared/application/id-generator.js';
import { AccessTokenService } from '../../shared/auth/access-token.service.js';
import { APP_CONFIG, type AppConfig } from '../../shared/config/app-config.js';
import { EmailSender } from '../../shared/email/email-sender.js';
import {
  GetCurrentUser,
  Logout,
  RefreshSession,
  RequestMagicLink,
  VerifyMagicLink,
} from './application/auth.use-cases.js';
import { AccessTokenIssuer, AuthSettings, SecureTokens } from './application/ports.js';
import { SessionIssuer } from './application/session-issuer.js';
import { MagicLinkRepository } from './domain/magic-link.js';
import { RefreshTokenRepository } from './domain/refresh-token.js';
import { UserRepository } from './domain/user.js';
import { NodeSecureTokens } from './infrastructure/node-secure-tokens.js';
import {
  DrizzleMagicLinkRepository,
  DrizzleRefreshTokenRepository,
  DrizzleUserRepository,
} from './infrastructure/persistence/drizzle-auth.repositories.js';
import { AuthController } from './interface/http/auth.controller.js';

/** Passwordless authentication (ADR-0013). Users live here; other modules reference them by id. */
@Module({
  imports: [
    // In-memory per-IP limits (one instance). A shared store (Redis) is needed when scaling out.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
  ],
  controllers: [AuthController],
  providers: [
    { provide: UserRepository, useClass: DrizzleUserRepository },
    { provide: MagicLinkRepository, useClass: DrizzleMagicLinkRepository },
    { provide: RefreshTokenRepository, useClass: DrizzleRefreshTokenRepository },
    { provide: SecureTokens, useClass: NodeSecureTokens },
    { provide: AccessTokenIssuer, useExisting: AccessTokenService },
    {
      provide: AuthSettings,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig): AuthSettings => ({
        magicLinkTtlMinutes: config.auth.magicLinkTtlMinutes,
        magicLinkUrl: config.auth.magicLinkUrl,
        refreshTokenTtlDays: config.auth.refreshTokenTtlDays,
        maxMagicLinksPerWindow: 3,
        magicLinkWindowMinutes: 15,
      }),
    },
    {
      provide: SessionIssuer,
      inject: [
        RefreshTokenRepository,
        AccessTokenIssuer,
        SecureTokens,
        Clock,
        IdGenerator,
        AuthSettings,
      ],
      useFactory: (...deps: ConstructorParameters<typeof SessionIssuer>) =>
        new SessionIssuer(...deps),
    },
    {
      provide: RequestMagicLink,
      inject: [MagicLinkRepository, EmailSender, SecureTokens, Clock, IdGenerator, AuthSettings],
      useFactory: (...deps: ConstructorParameters<typeof RequestMagicLink>) =>
        new RequestMagicLink(...deps),
    },
    {
      provide: VerifyMagicLink,
      inject: [
        MagicLinkRepository,
        UserRepository,
        SessionIssuer,
        SecureTokens,
        Clock,
        IdGenerator,
      ],
      useFactory: (...deps: ConstructorParameters<typeof VerifyMagicLink>) =>
        new VerifyMagicLink(...deps),
    },
    {
      provide: RefreshSession,
      inject: [RefreshTokenRepository, UserRepository, SessionIssuer, SecureTokens, Clock],
      useFactory: (...deps: ConstructorParameters<typeof RefreshSession>) =>
        new RefreshSession(...deps),
    },
    {
      provide: Logout,
      inject: [RefreshTokenRepository, SecureTokens, Clock],
      useFactory: (...deps: ConstructorParameters<typeof Logout>) => new Logout(...deps),
    },
    {
      provide: GetCurrentUser,
      inject: [UserRepository],
      useFactory: (users: UserRepository) => new GetCurrentUser(users),
    },
  ],
  exports: [UserRepository],
})
export class AuthModule {}
