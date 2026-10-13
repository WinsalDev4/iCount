import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiBody,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  type LogoutRequest,
  logoutRequestSchema,
  type RefreshSessionRequest,
  refreshSessionRequestSchema,
  type RequestMagicLinkRequest,
  requestMagicLinkRequestSchema,
  type SessionDto,
  sessionDtoSchema,
  type UserDto,
  userDtoSchema,
  type VerifyMagicLinkRequest,
  verifyMagicLinkRequestSchema,
} from '@icount/contracts';

import type { AuthenticatedUser } from '../../../../shared/auth/authenticated-user.js';
import { CurrentUser } from '../../../../shared/auth/current-user.decorator.js';
import { Public } from '../../../../shared/auth/public.decorator.js';
import { ApiProblemResponses, zodToOpenApi } from '../../../../shared/interface/http/openapi.js';
import { ZodValidationPipe } from '../../../../shared/interface/http/zod-validation.pipe.js';
import {
  GetCurrentUser,
  Logout,
  RefreshSession,
  RequestMagicLink,
  VerifyMagicLink,
} from '../../application/auth.use-cases.js';
import type { Session } from '../../application/session-issuer.js';
import type { User } from '../../domain/user.js';

const MINUTE = 60_000;

/** Passwordless auth endpoints (ADR-0013). Throttled per client IP on top of the per-email limit. */
@ApiTags('auth')
@Controller()
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(
    private readonly requestMagicLink: RequestMagicLink,
    private readonly verifyMagicLink: VerifyMagicLink,
    private readonly refreshSession: RefreshSession,
    private readonly logout: Logout,
    private readonly getCurrentUser: GetCurrentUser,
  ) {}

  @Public()
  @Post('auth/magic-link')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 5, ttl: MINUTE } })
  @ApiBody({ schema: zodToOpenApi(requestMagicLinkRequestSchema, 'input') })
  @ApiAcceptedResponse({
    description: 'Sent if the address can receive it (same answer either way)',
  })
  @ApiProblemResponses(400, 429)
  async magicLink(
    @Body(new ZodValidationPipe(requestMagicLinkRequestSchema)) body: RequestMagicLinkRequest,
  ): Promise<void> {
    await this.requestMagicLink.execute(body.email);
  }

  @Public()
  @Post('auth/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: MINUTE } })
  @ApiBody({ schema: zodToOpenApi(verifyMagicLinkRequestSchema, 'input') })
  @ApiOkResponse({ schema: zodToOpenApi(sessionDtoSchema) })
  @ApiProblemResponses(400, 401, 429)
  async verify(
    @Body(new ZodValidationPipe(verifyMagicLinkRequestSchema)) body: VerifyMagicLinkRequest,
  ): Promise<SessionDto> {
    return toSessionDto(await this.verifyMagicLink.execute(body.token));
  }

  @Public()
  @Post('auth/refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: MINUTE } })
  @ApiBody({ schema: zodToOpenApi(refreshSessionRequestSchema, 'input') })
  @ApiOkResponse({ schema: zodToOpenApi(sessionDtoSchema) })
  @ApiProblemResponses(400, 401, 429)
  async refresh(
    @Body(new ZodValidationPipe(refreshSessionRequestSchema)) body: RefreshSessionRequest,
  ): Promise<SessionDto> {
    return toSessionDto(await this.refreshSession.execute(body.refreshToken));
  }

  @Public()
  @Post('auth/logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBody({ schema: zodToOpenApi(logoutRequestSchema, 'input') })
  @ApiNoContentResponse({ description: 'The session family is revoked (idempotent)' })
  @ApiProblemResponses(400)
  async signOut(
    @Body(new ZodValidationPipe(logoutRequestSchema)) body: LogoutRequest,
  ): Promise<void> {
    await this.logout.execute(body.refreshToken);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOkResponse({ schema: zodToOpenApi(userDtoSchema) })
  @ApiProblemResponses(401)
  async me(@CurrentUser() current: AuthenticatedUser): Promise<UserDto> {
    return toUserDto(await this.getCurrentUser.execute(current.userId));
  }
}

function toUserDto(user: User): UserDto {
  return userDtoSchema.parse({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt.toISOString(),
  });
}

function toSessionDto(session: Session): SessionDto {
  return {
    accessToken: session.accessToken,
    accessTokenExpiresAt: session.accessTokenExpiresAt.toISOString(),
    refreshToken: session.refreshToken,
    user: toUserDto(session.user),
  };
}
