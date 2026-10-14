import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  type BudgetDto,
  budgetDtoSchema,
  type CreateBudgetRequest,
  createBudgetRequestSchema,
  monthQuerySchema,
  type MoveBudgetAmountRequest,
  moveBudgetAmountRequestSchema,
  type UpdateBudgetRequest,
  updateBudgetRequestSchema,
} from '@icount/contracts';
import { z } from 'zod';

import type { AuthenticatedUser } from '../../../../shared/auth/authenticated-user.js';
import { CurrentUser } from '../../../../shared/auth/current-user.decorator.js';
import { ApiProblemResponses, zodToOpenApi } from '../../../../shared/interface/http/openapi.js';
import { ZodValidationPipe } from '../../../../shared/interface/http/zod-validation.pipe.js';
import {
  CreateBudget,
  DeleteBudget,
  ListBudgets,
  MoveBudgetAmount,
  UpdateBudgetLimit,
} from '../../application/budgets.use-cases.js';
import type { BudgetWithSpending } from '../../domain/budget.js';

const uuidParam = new ZodValidationPipe(z.uuid());

@ApiTags('budgets')
@ApiBearerAuth()
@Controller()
export class BudgetsController {
  constructor(
    private readonly listBudgets: ListBudgets,
    private readonly createBudget: CreateBudget,
    private readonly updateBudgetLimit: UpdateBudgetLimit,
    private readonly deleteBudget: DeleteBudget,
    private readonly moveBudgetAmount: MoveBudgetAmount,
  ) {}

  @Get('households/:householdId/budgets')
  @ApiOkResponse({ schema: zodToOpenApi(z.array(budgetDtoSchema)) })
  @ApiProblemResponses(400, 401, 404)
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('householdId', uuidParam) householdId: string,
    @Query(new ZodValidationPipe(monthQuerySchema)) query: { month: string },
  ): Promise<BudgetDto[]> {
    return (await this.listBudgets.execute(user.userId, householdId, query.month)).map(toBudgetDto);
  }

  @Post('households/:householdId/budgets')
  @ApiBody({ schema: zodToOpenApi(createBudgetRequestSchema, 'input') })
  @ApiCreatedResponse({ schema: zodToOpenApi(budgetDtoSchema) })
  @ApiProblemResponses(400, 401, 404, 409, 422)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('householdId', uuidParam) householdId: string,
    @Body(new ZodValidationPipe(createBudgetRequestSchema)) body: CreateBudgetRequest,
  ): Promise<BudgetDto> {
    return toBudgetDto(
      await this.createBudget.execute(user.userId, householdId, {
        categoryId: body.categoryId,
        month: body.month,
        limitMinor: body.limit.amountMinor,
        currency: body.limit.currency,
      }),
    );
  }

  @Post('households/:householdId/budgets/move')
  @HttpCode(HttpStatus.OK)
  @ApiBody({ schema: zodToOpenApi(moveBudgetAmountRequestSchema, 'input') })
  @ApiOkResponse({ schema: zodToOpenApi(z.array(budgetDtoSchema)) })
  @ApiProblemResponses(400, 401, 404, 422)
  async move(
    @CurrentUser() user: AuthenticatedUser,
    @Param('householdId', uuidParam) householdId: string,
    @Body(new ZodValidationPipe(moveBudgetAmountRequestSchema)) body: MoveBudgetAmountRequest,
  ): Promise<BudgetDto[]> {
    const moved = await this.moveBudgetAmount.execute(user.userId, householdId, {
      fromId: body.fromBudgetId,
      toId: body.toBudgetId,
      amountMinor: body.amount.amountMinor,
      currency: body.amount.currency,
    });
    return moved.map(toBudgetDto);
  }

  @Patch('budgets/:id')
  @ApiBody({ schema: zodToOpenApi(updateBudgetRequestSchema, 'input') })
  @ApiOkResponse({ schema: zodToOpenApi(budgetDtoSchema) })
  @ApiProblemResponses(400, 401, 404, 422)
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidParam) id: string,
    @Body(new ZodValidationPipe(updateBudgetRequestSchema)) body: UpdateBudgetRequest,
  ): Promise<BudgetDto> {
    return toBudgetDto(await this.updateBudgetLimit.execute(user.userId, id, body.limit));
  }

  @Delete('budgets/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Deleted' })
  @ApiProblemResponses(400, 401, 404)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id', uuidParam) id: string) {
    await this.deleteBudget.execute(user.userId, id);
  }
}

function toBudgetDto(budget: BudgetWithSpending): BudgetDto {
  const money = (amountMinor: number) => ({ amountMinor, currency: budget.currency });
  return budgetDtoSchema.parse({
    id: budget.id,
    householdId: budget.householdId,
    categoryId: budget.categoryId,
    month: budget.month,
    limit: money(budget.limitMinor),
    spent: money(budget.spentMinor),
    remaining: money(budget.limitMinor - budget.spentMinor),
  });
}
