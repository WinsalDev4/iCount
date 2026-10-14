import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import type { AuthenticatedUser } from './authenticated-user.js';

/** `@CurrentUser() user: AuthenticatedUser` in handlers of authenticated routes. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const auth = context.switchToHttp().getRequest<Request>().auth;
    // JwtAuthGuard runs first; reaching here without auth means a @Public() route used it.
    if (!auth) throw new Error('@CurrentUser() used on a route without authentication');
    return auth;
  },
);
