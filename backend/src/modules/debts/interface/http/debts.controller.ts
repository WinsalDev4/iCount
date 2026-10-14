import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Put,
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
  type AmortizationScheduleDto,
  amortizationScheduleDtoSchema,
  type CreateDebtRequest,
  createDebtRequestSchema,
  type DebtDto,
  debtDtoSchema,
  type PayoffStrategyQuery,
  payoffStrategyQuerySchema,
  type PayoffStrategyResultDto,
  payoffStrategyResultDtoSchema,
  transactionDtoSchema,
  type UpdateDebtRequest,
  updateDebtRequestSchema,
} from '@icount/contracts';
import { z } from 'zod';

import type { AuthenticatedUser } from '../../../../shared/auth/authenticated-user.js';
import { CurrentUser } from '../../../../shared/auth/current-user.decorator.js';
import { TODAY, type Today } from '../../../../shared/application/today.js';
import { ApiProblemResponses, zodToOpenApi } from '../../../../shared/interface/http/openapi.js';
import { ZodValidationPipe } from '../../../../shared/interface/http/zod-validation.pipe.js';
import { CurrencyMismatchError } from '../../../households/domain/households.errors.js';
import { toTransactionDto } from '../../../transactions/interface/http/transactions.controller.js';
import {
  CreateDebt,
  DeleteDebt,
  GetDebt,
  LinkDebtPayment,
  ListDebtPayments,
  ListDebts,
  PlanDebtPayoff,
  UnlinkDebtPayment,
  UpdateDebt,
} from '../../application/debts.use-cases.js';
import type { Debt } from '../../domain/debt.js';

const uuidParam = new ZodValidationPipe(z.uuid());

@ApiTags('debts')
@ApiBearerAuth()
@Controller()
export class DebtsController {
  constructor(
    private readonly listDebts: ListDebts,
    private readonly getDebt: GetDebt,
    private readonly createDebt: CreateDebt,
    private readonly updateDebt: UpdateDebt,
    private readonly deleteDebt: DeleteDebt,
    private readonly linkPayment: LinkDebtPayment,
    private readonly unlinkPayment: UnlinkDebtPayment,
    private readonly listPayments: ListDebtPayments,
    private readonly planPayoff: PlanDebtPayoff,
    @Inject(TODAY) private readonly today: Today,
  ) {}

  @Get('households/:householdId/debts')
  @ApiOkResponse({ schema: zodToOpenApi(z.array(debtDtoSchema)) })
  @ApiProblemResponses(400, 401, 404)
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('householdId', uuidParam) householdId: string,
  ): Promise<DebtDto[]> {
    const today = this.today();
    return (await this.listDebts.execute(user.userId, householdId)).map((d) => toDebtDto(d, today));
  }

  @Get('households/:householdId/debts/strategy')
  @ApiOkResponse({ schema: zodToOpenApi(payoffStrategyResultDtoSchema) })
  @ApiProblemResponses(400, 401, 404)
  async strategy(
    @CurrentUser() user: AuthenticatedUser,
    @Param('householdId', uuidParam) householdId: string,
    @Query(new ZodValidationPipe(payoffStrategyQuerySchema)) query: PayoffStrategyQuery,
  ): Promise<PayoffStrategyResultDto> {
    const plan = await this.planPayoff.execute(
      user.userId,
      householdId,
      query.strategy,
      query.extraMonthlyMinor,
    );
    const money = (amountMinor: number) => ({ amountMinor, currency: plan.currency });
    return payoffStrategyResultDtoSchema.parse({
      strategy: plan.strategy,
      extraMonthly: money(plan.extraMonthlyMinor),
      debts: plan.debts.map((debt) => ({
        debtId: debt.id,
        order: debt.order,
        payoffDate: debt.payoffDate,
        interestPaid: money(debt.interestPaidMinor),
      })),
      totalInterest: money(plan.totalInterestMinor),
      debtFreeDate: plan.debtFreeDate,
    });
  }

  @Post('households/:householdId/debts')
  @ApiBody({ schema: zodToOpenApi(createDebtRequestSchema, 'input') })
  @ApiCreatedResponse({ schema: zodToOpenApi(debtDtoSchema) })
  @ApiProblemResponses(400, 401, 404, 422)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('householdId', uuidParam) householdId: string,
    @Body(new ZodValidationPipe(createDebtRequestSchema)) body: CreateDebtRequest,
  ): Promise<DebtDto> {
    const { principal, monthlyPayment, ...fields } = body;
    if (monthlyPayment && monthlyPayment.currency !== principal.currency) {
      throw new CurrencyMismatchError(principal.currency, monthlyPayment.currency);
    }
    const debt = await this.createDebt.execute(user.userId, householdId, {
      ...fields,
      principalMinor: principal.amountMinor,
      currency: principal.currency,
      ...(monthlyPayment ? { monthlyPaymentMinor: monthlyPayment.amountMinor } : {}),
    });
    return toDebtDto(debt, this.today());
  }

  @Get('debts/:id')
  @ApiOkResponse({ schema: zodToOpenApi(debtDtoSchema) })
  @ApiProblemResponses(400, 401, 404)
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidParam) id: string,
  ): Promise<DebtDto> {
    return toDebtDto(await this.getDebt.execute(user.userId, id), this.today());
  }

  @Get('debts/:id/schedule')
  @ApiOkResponse({ schema: zodToOpenApi(amortizationScheduleDtoSchema) })
  @ApiProblemResponses(400, 401, 404)
  async schedule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidParam) id: string,
  ): Promise<AmortizationScheduleDto> {
    const debt = await this.getDebt.execute(user.userId, id);
    const { rows, totalInterestMinor } = debt.schedule();
    const money = (amountMinor: number) => ({ amountMinor, currency: debt.snapshot.currency });
    return amortizationScheduleDtoSchema.parse({
      debtId: debt.id,
      rows: rows.map((row) => ({
        period: row.period,
        date: row.date,
        payment: money(row.paymentMinor),
        interest: money(row.interestMinor),
        principal: money(row.principalMinor),
        balance: money(row.balanceMinor),
      })),
      totalInterest: money(totalInterestMinor),
    });
  }

  @Patch('debts/:id')
  @ApiBody({ schema: zodToOpenApi(updateDebtRequestSchema, 'input') })
  @ApiOkResponse({ schema: zodToOpenApi(debtDtoSchema) })
  @ApiProblemResponses(400, 401, 404, 422)
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidParam) id: string,
    @Body(new ZodValidationPipe(updateDebtRequestSchema)) body: UpdateDebtRequest,
  ): Promise<DebtDto> {
    const { monthlyPayment, ...fields } = body;
    const debt = await this.updateDebt.execute(user.userId, id, {
      ...fields,
      ...(monthlyPayment
        ? { monthlyPaymentMinor: monthlyPayment.amountMinor, currency: monthlyPayment.currency }
        : {}),
    });
    return toDebtDto(debt, this.today());
  }

  @Delete('debts/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Deleted (its movements stay)' })
  @ApiProblemResponses(400, 401, 404)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id', uuidParam) id: string) {
    await this.deleteDebt.execute(user.userId, id);
  }

  @Get('debts/:id/payments')
  @ApiOkResponse({ schema: zodToOpenApi(z.array(transactionDtoSchema)) })
  @ApiProblemResponses(400, 401, 404)
  async payments(@CurrentUser() user: AuthenticatedUser, @Param('id', uuidParam) id: string) {
    return (await this.listPayments.execute(user.userId, id)).map(toTransactionDto);
  }

  @Put('debts/:id/payments/:transactionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Linked (idempotent)' })
  @ApiProblemResponses(400, 401, 404, 422)
  async link(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidParam) id: string,
    @Param('transactionId', uuidParam) transactionId: string,
  ) {
    await this.linkPayment.execute(user.userId, id, transactionId);
  }

  @Delete('debts/:id/payments/:transactionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Unlinked' })
  @ApiProblemResponses(400, 401, 404)
  async unlink(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidParam) id: string,
    @Param('transactionId', uuidParam) transactionId: string,
  ) {
    await this.unlinkPayment.execute(user.userId, id, transactionId);
  }
}

function toDebtDto(debt: Debt, today: string): DebtDto {
  const d = debt.snapshot;
  const money = (amountMinor: number) => ({ amountMinor, currency: d.currency });
  return debtDtoSchema.parse({
    id: d.id,
    householdId: d.householdId,
    name: d.name,
    kind: d.kind,
    principal: money(d.principalMinor),
    outstanding: money(debt.outstandingOn(today)),
    annualRateBps: d.annualRateBps,
    aprBps: d.aprBps,
    monthlyPayment: money(d.monthlyPaymentMinor),
    startDate: d.startDate,
    termMonths: d.termMonths,
    endDate: debt.schedule().payoffDate ?? d.startDate,
    createdAt: d.createdAt.toISOString(),
  });
}
