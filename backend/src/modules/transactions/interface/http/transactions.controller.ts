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
  Res,
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
  type CreateTransactionRequest,
  createTransactionRequestSchema,
  type DailyTotalsDto,
  dailyTotalsDtoSchema,
  type ListTransactionsQuery,
  listTransactionsQuerySchema,
  monthQuerySchema,
  type MonthlySummaryDto,
  monthlySummaryDtoSchema,
  type TransactionDto,
  transactionDtoSchema,
  type TransactionPage,
  transactionPageSchema,
  type UpdateTransactionRequest,
  updateTransactionRequestSchema,
} from '@icount/contracts';
import type { Response } from 'express';
import { z } from 'zod';

import type { AuthenticatedUser } from '../../../../shared/auth/authenticated-user.js';
import { CurrentUser } from '../../../../shared/auth/current-user.decorator.js';
import { ApiProblemResponses, zodToOpenApi } from '../../../../shared/interface/http/openapi.js';
import { ZodValidationPipe } from '../../../../shared/interface/http/zod-validation.pipe.js';
import {
  CreateTransaction,
  DeleteTransaction,
  GetDailyTotals,
  GetMonthlySummary,
  GetTransaction,
  ListTransactions,
  UpdateTransaction,
} from '../../application/transactions.use-cases.js';
import type { Transaction } from '../../domain/transaction.js';

const uuidParam = new ZodValidationPipe(z.uuid());

@ApiTags('transactions')
@ApiBearerAuth()
@Controller()
export class TransactionsController {
  constructor(
    private readonly createTransaction: CreateTransaction,
    private readonly getTransaction: GetTransaction,
    private readonly updateTransaction: UpdateTransaction,
    private readonly deleteTransaction: DeleteTransaction,
    private readonly listTransactions: ListTransactions,
    private readonly getMonthlySummary: GetMonthlySummary,
    private readonly getDailyTotals: GetDailyTotals,
  ) {}

  @Post('households/:householdId/transactions')
  @ApiBody({ schema: zodToOpenApi(createTransactionRequestSchema, 'input') })
  @ApiCreatedResponse({
    description: 'Created (200 when the same client id is replayed)',
    schema: zodToOpenApi(transactionDtoSchema),
  })
  @ApiProblemResponses(400, 401, 404, 409, 422)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('householdId', uuidParam) householdId: string,
    @Body(new ZodValidationPipe(createTransactionRequestSchema)) body: CreateTransactionRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<TransactionDto> {
    const { amount, ...fields } = body;
    const { transaction, created } = await this.createTransaction.execute(
      user.userId,
      householdId,
      {
        ...fields,
        amountMinor: amount.amountMinor,
        currency: amount.currency,
      },
    );
    if (!created) response.status(HttpStatus.OK);
    return toTransactionDto(transaction);
  }

  @Get('households/:householdId/transactions')
  @ApiOkResponse({ schema: zodToOpenApi(transactionPageSchema) })
  @ApiProblemResponses(400, 401, 404, 422)
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('householdId', uuidParam) householdId: string,
    @Query(new ZodValidationPipe(listTransactionsQuerySchema)) query: ListTransactionsQuery,
  ): Promise<TransactionPage> {
    const { cursor, limit, q, ...filters } = query;
    const page = await this.listTransactions.execute(
      user.userId,
      householdId,
      { ...filters, query: q },
      { cursor, limit },
    );
    return { items: page.items.map(toTransactionDto), nextCursor: page.nextCursor };
  }

  @Get('households/:householdId/summary')
  @ApiOkResponse({ schema: zodToOpenApi(monthlySummaryDtoSchema) })
  @ApiProblemResponses(400, 401, 404)
  async summary(
    @CurrentUser() user: AuthenticatedUser,
    @Param('householdId', uuidParam) householdId: string,
    @Query(new ZodValidationPipe(monthQuerySchema)) query: { month: string },
  ): Promise<MonthlySummaryDto> {
    const totals = await this.getMonthlySummary.execute(user.userId, householdId, query.month);
    const money = (amountMinor: number) => ({ amountMinor, currency: totals.currency });
    return monthlySummaryDtoSchema.parse({
      month: query.month,
      income: money(totals.incomeMinor),
      expenses: money(totals.expensesMinor),
      balance: money(totals.incomeMinor - totals.expensesMinor),
      expensesByCategory: totals.expensesByCategory.map((entry) => ({
        categoryId: entry.categoryId,
        amount: money(entry.amountMinor),
      })),
    });
  }

  @Get('households/:householdId/daily-totals')
  @ApiOkResponse({ schema: zodToOpenApi(dailyTotalsDtoSchema) })
  @ApiProblemResponses(400, 401, 404)
  async dailyTotals(
    @CurrentUser() user: AuthenticatedUser,
    @Param('householdId', uuidParam) householdId: string,
    @Query(new ZodValidationPipe(monthQuerySchema)) query: { month: string },
  ): Promise<DailyTotalsDto> {
    const { days, currency } = await this.getDailyTotals.execute(
      user.userId,
      householdId,
      query.month,
    );
    return dailyTotalsDtoSchema.parse({
      month: query.month,
      days: days.map((day) => ({
        date: day.date,
        income: { amountMinor: day.incomeMinor, currency },
        expenses: { amountMinor: day.expensesMinor, currency },
      })),
    });
  }

  @Get('transactions/:id')
  @ApiOkResponse({ schema: zodToOpenApi(transactionDtoSchema) })
  @ApiProblemResponses(400, 401, 404)
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidParam) id: string,
  ): Promise<TransactionDto> {
    return toTransactionDto(await this.getTransaction.execute(user.userId, id));
  }

  @Patch('transactions/:id')
  @ApiBody({ schema: zodToOpenApi(updateTransactionRequestSchema, 'input') })
  @ApiOkResponse({ schema: zodToOpenApi(transactionDtoSchema) })
  @ApiProblemResponses(400, 401, 404, 422)
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidParam) id: string,
    @Body(new ZodValidationPipe(updateTransactionRequestSchema)) body: UpdateTransactionRequest,
  ): Promise<TransactionDto> {
    const { amount, ...fields } = body;
    return toTransactionDto(
      await this.updateTransaction.execute(user.userId, id, {
        ...fields,
        ...(amount ? { amountMinor: amount.amountMinor, currency: amount.currency } : {}),
      }),
    );
  }

  @Delete('transactions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Deleted' })
  @ApiProblemResponses(400, 401, 404)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidParam) id: string,
  ): Promise<void> {
    await this.deleteTransaction.execute(user.userId, id);
  }
}

function toTransactionDto(transaction: Transaction): TransactionDto {
  const tx = transaction.snapshot;
  const money = (amountMinor: number) => ({ amountMinor, currency: tx.currency });
  return transactionDtoSchema.parse({
    id: tx.id,
    householdId: tx.householdId,
    type: tx.type,
    amount: money(tx.amountMinor),
    categoryId: tx.categoryId,
    description: tx.description,
    occurredOn: tx.occurredOn,
    payerId: tx.payerId,
    shared: tx.shared,
    shares: tx.shares.map((share) => ({
      memberId: share.memberId,
      amount: money(share.amountMinor),
    })),
    createdAt: tx.createdAt.toISOString(),
    updatedAt: tx.updatedAt.toISOString(),
  });
}
