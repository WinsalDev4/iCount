import { Body, Controller, Delete, HttpCode, HttpStatus, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiNoContentResponse, ApiTags } from '@nestjs/swagger';
import {
  type RegisterPushTokenRequest,
  registerPushTokenRequestSchema,
  type UnregisterPushTokenRequest,
  unregisterPushTokenRequestSchema,
} from '@icount/contracts';

import type { AuthenticatedUser } from '../../../../shared/auth/authenticated-user.js';
import { CurrentUser } from '../../../../shared/auth/current-user.decorator.js';
import { ApiProblemResponses, zodToOpenApi } from '../../../../shared/interface/http/openapi.js';
import { ZodValidationPipe } from '../../../../shared/interface/http/zod-validation.pipe.js';
import { RegisterPushToken, UnregisterPushToken } from '../../application/push.use-cases.js';

@ApiTags('push')
@ApiBearerAuth()
@Controller('me/push-tokens')
export class PushController {
  constructor(
    private readonly registerToken: RegisterPushToken,
    private readonly unregisterToken: UnregisterPushToken,
  ) {}

  @Put()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBody({ schema: zodToOpenApi(registerPushTokenRequestSchema, 'input') })
  @ApiNoContentResponse({ description: 'Registered (idempotent)' })
  @ApiProblemResponses(400, 401)
  async register(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(registerPushTokenRequestSchema)) body: RegisterPushTokenRequest,
  ): Promise<void> {
    await this.registerToken.execute(user.userId, body.token, body.platform, body.deviceName);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBody({ schema: zodToOpenApi(unregisterPushTokenRequestSchema, 'input') })
  @ApiNoContentResponse({ description: 'Unregistered (also when it was not registered)' })
  @ApiProblemResponses(400, 401)
  async unregister(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(unregisterPushTokenRequestSchema)) body: UnregisterPushTokenRequest,
  ): Promise<void> {
    await this.unregisterToken.execute(user.userId, body.token);
  }
}
