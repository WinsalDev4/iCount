import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  type CreateHouseholdRequest,
  createHouseholdRequestSchema,
  type HouseholdDto,
  householdDtoSchema,
  type InvitationDto,
  invitationDtoSchema,
  type JoinHouseholdRequest,
  joinHouseholdRequestSchema,
  type SetMemberIncomeRequest,
  setMemberIncomeRequestSchema,
  type SetSplitRuleRequest,
  setSplitRuleRequestSchema,
} from '@icount/contracts';
import { z } from 'zod';

import type { AuthenticatedUser } from '../../../../shared/auth/authenticated-user.js';
import { CurrentUser } from '../../../../shared/auth/current-user.decorator.js';
import { ApiProblemResponses, zodToOpenApi } from '../../../../shared/interface/http/openapi.js';
import { ZodValidationPipe } from '../../../../shared/interface/http/zod-validation.pipe.js';
import {
  CreateHousehold,
  CreateInvitation,
  GetHousehold,
  JoinHousehold,
  ListMyHouseholds,
  SetMyIncome,
  SetSplitRule,
} from '../../application/households.use-cases.js';
import type { Household } from '../../domain/household.js';
import type { Invitation } from '../../domain/invitation.js';

const householdIdParam = new ZodValidationPipe(z.uuid());

/** Every route is scoped to the caller's memberships (404 for households of others). */
@ApiTags('households')
@ApiBearerAuth()
@Controller('households')
export class HouseholdsController {
  constructor(
    private readonly createHousehold: CreateHousehold,
    private readonly listMyHouseholds: ListMyHouseholds,
    private readonly getHousehold: GetHousehold,
    private readonly createInvitation: CreateInvitation,
    private readonly joinHousehold: JoinHousehold,
    private readonly setSplitRule: SetSplitRule,
    private readonly setMyIncome: SetMyIncome,
  ) {}

  @Post()
  @ApiBody({ schema: zodToOpenApi(createHouseholdRequestSchema, 'input') })
  @ApiCreatedResponse({ schema: zodToOpenApi(householdDtoSchema) })
  @ApiProblemResponses(400, 401)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createHouseholdRequestSchema)) body: CreateHouseholdRequest,
  ): Promise<HouseholdDto> {
    return toHouseholdDto(await this.createHousehold.execute(user.userId, body));
  }

  @Get()
  @ApiOkResponse({ schema: zodToOpenApi(z.array(householdDtoSchema)) })
  @ApiProblemResponses(401)
  async mine(@CurrentUser() user: AuthenticatedUser): Promise<HouseholdDto[]> {
    return (await this.listMyHouseholds.execute(user.userId)).map(toHouseholdDto);
  }

  @Post('join')
  @HttpCode(HttpStatus.OK)
  @ApiBody({ schema: zodToOpenApi(joinHouseholdRequestSchema, 'input') })
  @ApiOkResponse({ schema: zodToOpenApi(householdDtoSchema) })
  @ApiProblemResponses(400, 401, 404, 409, 422)
  async join(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(joinHouseholdRequestSchema)) body: JoinHouseholdRequest,
  ): Promise<HouseholdDto> {
    return toHouseholdDto(await this.joinHousehold.execute(user.userId, body.code));
  }

  @Get(':id')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ schema: zodToOpenApi(householdDtoSchema) })
  @ApiProblemResponses(400, 401, 404)
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', householdIdParam) id: string,
  ): Promise<HouseholdDto> {
    return toHouseholdDto(await this.getHousehold.execute(user.userId, id));
  }

  @Post(':id/invitations')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiCreatedResponse({ schema: zodToOpenApi(invitationDtoSchema) })
  @ApiProblemResponses(400, 401, 403, 404, 422)
  async invite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', householdIdParam) id: string,
  ): Promise<InvitationDto> {
    return toInvitationDto(await this.createInvitation.execute(user.userId, id));
  }

  @Put(':id/split-rule')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ schema: zodToOpenApi(setSplitRuleRequestSchema, 'input') })
  @ApiOkResponse({ schema: zodToOpenApi(householdDtoSchema) })
  @ApiProblemResponses(400, 401, 403, 404, 422)
  async splitRule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', householdIdParam) id: string,
    @Body(new ZodValidationPipe(setSplitRuleRequestSchema)) body: SetSplitRuleRequest,
  ): Promise<HouseholdDto> {
    return toHouseholdDto(await this.setSplitRule.execute(user.userId, id, body.splitRule));
  }

  @Put(':id/members/me/income')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ schema: zodToOpenApi(setMemberIncomeRequestSchema, 'input') })
  @ApiOkResponse({ schema: zodToOpenApi(householdDtoSchema) })
  @ApiProblemResponses(400, 401, 404, 422)
  async income(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', householdIdParam) id: string,
    @Body(new ZodValidationPipe(setMemberIncomeRequestSchema)) body: SetMemberIncomeRequest,
  ): Promise<HouseholdDto> {
    return toHouseholdDto(await this.setMyIncome.execute(user.userId, id, body.monthlyIncome));
  }
}

function toHouseholdDto(household: Household): HouseholdDto {
  return householdDtoSchema.parse({
    id: household.id,
    name: household.name,
    kind: household.kind,
    currency: household.currency,
    splitRule: household.splitRule,
    createdAt: household.createdAt.toISOString(),
    members: household.members.map((member) => ({
      userId: member.userId,
      email: member.email,
      displayName: member.displayName,
      role: member.role,
      monthlyIncome:
        member.monthlyIncomeMinor === null
          ? null
          : { amountMinor: member.monthlyIncomeMinor, currency: household.currency },
      joinedAt: member.joinedAt.toISOString(),
    })),
  });
}

function toInvitationDto(invitation: Invitation): InvitationDto {
  return invitationDtoSchema.parse({
    code: invitation.code,
    householdId: invitation.householdId,
    expiresAt: invitation.expiresAt.toISOString(),
  });
}
