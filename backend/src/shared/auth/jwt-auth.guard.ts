import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { AccessTokenService } from './access-token.service.js';
import { IS_PUBLIC } from './public.decorator.js';

/**
 * Global guard (registered as APP_GUARD): reads `Authorization: Bearer <jwt>`
 * and sets `request.auth`. Spring analogy: a OncePerRequestFilter that fills the
 * SecurityContext.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accessTokens: AccessTokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const [scheme, token] = (request.headers.authorization ?? '').split(' ');
    const user = scheme === 'Bearer' && token ? await this.accessTokens.verify(token) : null;
    if (!user) throw new UnauthorizedException('A valid access token is required');

    request.auth = user;
    return true;
  }
}
