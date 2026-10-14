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
  type CreateRecurringPaymentRequest,
  createRecurringPaymentRequestSchema,
  type RecurringPaymentDto,
  recurringPaymentDtoSchema,
  type UpcomingDueDto,
  upcomingDueDtoSchema,
  type UpcomingDueQuery,
  upcomingDueQuerySchema,
  type UpdateRecurringPaymentRequest,
  updateRecurringPaymentRequestSchema,
} from '@icount/contracts';
import { z } from 'zod';

import type { AuthenticatedUser } from '../../../../shared/auth/authenticated-user.js';
import { CurrentUser } from '../../../../shared/auth/current-user.decorator.js';
import { ApiProblemResponses, zodToOpenApi } from '../../../../shared/interface/http/openapi.js';
import { ZodValidationPipe } from '../../../../shared/interface/http/zod-validation.pipe.js';
import {
  CreateRecurringPayment,
  DeleteRecurringPayment,
  ListRecurringPayments,
  ListUpcomingDues,
  UpdateRecurringPayment,
} from '../../application/recurring.use-cases.js';
import type { RecurringPayment } from '../../domain/recurring-payment.js';

const uuidParam = new ZodValidationPipe(z.uuid());

@ApiTags('recurring')
@ApiBearerAuth()
@Controller()
export class RecurringController {
  constructor(
    private readonly listPayments: ListRecurringPayments,
    private readonly createPayment: CreateRecurringPayment,
    private readonly updatePayment: UpdateRecurringPayment,
    private readonly deletePayment: DeleteRecurringPayment,
    private readonly listUpcoming: ListUpcomingDues,
  ) {}

  @Get('households/:householdId/recurring')
  @ApiOkResponse({ schema: zodToOpenApi(z.array(recurringPaymentDtoSchema)) })
  @ApiProblemResponses(400, 401, 404)
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('householdId', uuidParam) householdId: string,
  ): Promise<RecurringPaymentDto[]> {
    return (await this.listPayments.execute(user.userId, householdId)).map(toDto);
  }

  @Get('households/:householdId/recurring/upcoming')
  @ApiOkResponse({ schema: zodToOpenApi(z.array(upcomingDueDtoSchema)) })
  @ApiProblemResponses(400, 401, 404)
  async upcoming(
    @CurrentUser() user: AuthenticatedUser,
    @Param('householdId', uuidParam) householdId: string,
    @Query(new ZodValidationPipe(upcomingDueQuerySchema)) query: UpcomingDueQuery,
  ): Promise<UpcomingDueDto[]> {
    const dues = await this.listUpcoming.execute(user.userId, householdId, query.from, query.to);
    return dues.map(({ payment, dueDate }) => {
      const p = payment.snapshot;
      return upcomingDueDtoSchema.parse({
        recurringPaymentId: p.id,
        name: p.name,
        dueDate,
        type: p.type,
        amount: { amountMinor: p.amountMinor, currency: p.currency },
        categoryId: p.categoryId,
      });
    });
  }

  @Post('households/:householdId/recurring')
  @ApiBody({ schema: zodToOpenApi(createRecurringPaymentRequestSchema, 'input') })
  @ApiCreatedResponse({ schema: zodToOpenApi(recurringPaymentDtoSchema) })
  @ApiProblemResponses(400, 401, 404, 422)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('householdId', uuidParam) householdId: string,
    @Body(new ZodValidationPipe(createRecurringPaymentRequestSchema))
    body: CreateRecurringPaymentRequest,
  ): Promise<RecurringPaymentDto> {
    const { amount, ...fields } = body;
    return toDto(
      await this.createPayment.execute(user.userId, householdId, {
        ...fields,
        amountMinor: amount.amountMinor,
        currency: amount.currency,
      }),
    );
  }

  @Patch('recurring/:id')
  @ApiBody({ schema: zodToOpenApi(updateRecurringPaymentRequestSchema, 'input') })
  @ApiOkResponse({ schema: zodToOpenApi(recurringPaymentDtoSchema) })
  @ApiProblemResponses(400, 401, 404, 422)
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidParam) id: string,
    @Body(new ZodValidationPipe(updateRecurringPaymentRequestSchema))
    body: UpdateRecurringPaymentRequest,
  ): Promise<RecurringPaymentDto> {
    const { amount, ...fields } = body;
    return toDto(
      await this.updatePayment.execute(user.userId, id, {
        ...fields,
        ...(amount ? { amountMinor: amount.amountMinor, currency: amount.currency } : {}),
      }),
    );
  }

  @Delete('recurring/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Deleted (movements already created stay)' })
  @ApiProblemResponses(400, 401, 404)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id', uuidParam) id: string) {
    await this.deletePayment.execute(user.userId, id);
  }
}

function toDto(payment: RecurringPayment): RecurringPaymentDto {
  const p = payment.snapshot;
  return recurringPaymentDtoSchema.parse({
    id: p.id,
    householdId: p.householdId,
    name: p.name,
    kind: p.kind,
    type: p.type,
    amount: { amountMinor: p.amountMinor, currency: p.currency },
    categoryId: p.categoryId,
    rule: p.rule,
    startDate: p.startDate,
    endDate: p.endDate,
    nextDueDate: p.nextDueDate,
    payerId: p.payerId,
    shared: p.shared,
    debtId: p.debtId,
    createdAt: p.createdAt.toISOString(),
  });
}
