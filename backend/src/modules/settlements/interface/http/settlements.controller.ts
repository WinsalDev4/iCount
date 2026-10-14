import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  type BalanceQuery,
  balanceQuerySchema,
  type CreateSettlementRequest,
  createSettlementRequestSchema,
  type HouseholdBalanceDto,
  householdBalanceDtoSchema,
  type SettlementDto,
  settlementDtoSchema,
} from '@icount/contracts';
import { z } from 'zod';

import type { AuthenticatedUser } from '../../../../shared/auth/authenticated-user.js';
import { CurrentUser } from '../../../../shared/auth/current-user.decorator.js';
import { ApiProblemResponses, zodToOpenApi } from '../../../../shared/interface/http/openapi.js';
import { ZodValidationPipe } from '../../../../shared/interface/http/zod-validation.pipe.js';
import {
  CreateSettlement,
  GetBalance,
  ListSettlements,
} from '../../application/settlements.use-cases.js';
import type { Settlement } from '../../domain/settlement.js';

const uuidParam = new ZodValidationPipe(z.uuid());

@ApiTags('settlements')
@ApiBearerAuth()
@Controller()
export class SettlementsController {
  constructor(
    private readonly getBalance: GetBalance,
    private readonly listSettlements: ListSettlements,
    private readonly createSettlement: CreateSettlement,
  ) {}

  @Get('households/:householdId/balance')
  @ApiOkResponse({ schema: zodToOpenApi(householdBalanceDtoSchema) })
  @ApiProblemResponses(400, 401, 404, 422)
  async balance(
    @CurrentUser() user: AuthenticatedUser,
    @Param('householdId', uuidParam) householdId: string,
    @Query(new ZodValidationPipe(balanceQuerySchema)) query: BalanceQuery,
  ): Promise<HouseholdBalanceDto> {
    const balance = await this.getBalance.execute(user.userId, householdId, query);
    const money = (amountMinor: number) => ({ amountMinor, currency: balance.currency });
    return householdBalanceDtoSchema.parse({
      householdId,
      members: balance.members.map((member) => ({
        memberId: member.memberId,
        paid: money(member.paidMinor),
        owed: money(member.owedMinor),
        net: money(member.netMinor),
      })),
      suggestedTransfers: balance.suggestedTransfers.map((transfer) => ({
        fromMemberId: transfer.fromMemberId,
        toMemberId: transfer.toMemberId,
        amount: money(transfer.amountMinor),
      })),
      pendingApprovalCount: balance.pendingApprovalCount,
    });
  }

  @Get('households/:householdId/settlements')
  @ApiOkResponse({ schema: zodToOpenApi(z.array(settlementDtoSchema)) })
  @ApiProblemResponses(400, 401, 404)
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('householdId', uuidParam) householdId: string,
  ): Promise<SettlementDto[]> {
    return (await this.listSettlements.execute(user.userId, householdId)).map(toSettlementDto);
  }

  @Post('households/:householdId/settlements')
  @ApiBody({ schema: zodToOpenApi(createSettlementRequestSchema, 'input') })
  @ApiCreatedResponse({ schema: zodToOpenApi(settlementDtoSchema) })
  @ApiProblemResponses(400, 401, 404, 422)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('householdId', uuidParam) householdId: string,
    @Body(new ZodValidationPipe(createSettlementRequestSchema)) body: CreateSettlementRequest,
  ): Promise<SettlementDto> {
    const { amount, ...fields } = body;
    return toSettlementDto(
      await this.createSettlement.execute(user.userId, householdId, {
        ...fields,
        amountMinor: amount.amountMinor,
        currency: amount.currency,
      }),
    );
  }
}

function toSettlementDto(settlement: Settlement): SettlementDto {
  const { amountMinor, currency, createdAt, ...fields } = settlement.snapshot;
  return settlementDtoSchema.parse({
    ...fields,
    amount: { amountMinor, currency },
    createdAt: createdAt.toISOString(),
  });
}
