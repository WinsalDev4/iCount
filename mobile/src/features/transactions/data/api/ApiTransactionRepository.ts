import {
  dailyTotalsDtoSchema,
  monthlySummaryDtoSchema,
  transactionDtoSchema,
  transactionPageSchema,
} from '@icount/contracts';
import { z } from 'zod';

import type { Page, PageRequest } from '@/core/domain/Page';
import type { YearMonth } from '@/core/domain/YearMonth';
import type { HttpError } from '@/core/network/HttpError';
import type { HttpClient, RequestOptions } from '@/core/network/httpClient';
import { isConnectivityError, problemCode } from '@/core/network/problemCode';

import type { MonthlySummary } from '../../domain/MonthlySummary';
import type {
  DailyTotal,
  NewTransaction,
  Transaction,
  TransactionChanges,
  TransactionFilters,
} from '../../domain/Transaction';
import { TransactionError } from '../../domain/TransactionError';
import type { TransactionRepository } from '../../domain/TransactionRepository';
import {
  toCreateRequest,
  toDailyTotals,
  toLocalDate,
  toMonthlySummary,
  toTransaction,
  toUpdateRequest,
  toYearMonthString,
} from './transactionMapper';

const MAX_PAGE_SIZE = 100;

/** TransactionRepository over the API. `http` is the authenticated client. */
export class ApiTransactionRepository implements TransactionRepository {
  constructor(private readonly http: HttpClient) {}

  /** Every movement of a month (walks all the pages). */
  async findByMonth(householdId: string, period: YearMonth): Promise<Transaction[]> {
    const lastDay = new Date(period.year, period.month, 0);
    const filters: TransactionFilters = {
      from: new Date(period.year, period.month - 1, 1),
      to: lastDay,
    };
    const all: Transaction[] = [];
    let cursor: string | undefined;
    do {
      const page = await this.list(householdId, filters, { cursor, limit: MAX_PAGE_SIZE });
      all.push(...page.items);
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    return all;
  }

  async list(
    householdId: string,
    filters: TransactionFilters,
    page: PageRequest,
  ): Promise<Page<Transaction>> {
    const result = await this.call(`/v1/households/${householdId}/transactions`, {
      schema: transactionPageSchema,
      query: {
        cursor: page.cursor,
        limit: page.limit,
        type: filters.type,
        categoryId: filters.categoryId,
        memberId: filters.memberId,
        shared: filters.shared,
        from: filters.from && toLocalDate(filters.from),
        to: filters.to && toLocalDate(filters.to),
        q: filters.query,
      },
    });
    return { items: result.items.map(toTransaction), nextCursor: result.nextCursor };
  }

  async getById(id: string): Promise<Transaction | null> {
    try {
      return toTransaction(
        await this.call(`/v1/transactions/${id}`, { schema: transactionDtoSchema }),
      );
    } catch (error) {
      if (error instanceof TransactionError && error.reason === 'not-found') return null;
      throw error;
    }
  }

  async create(input: NewTransaction): Promise<Transaction> {
    return toTransaction(
      await this.call(`/v1/households/${input.householdId}/transactions`, {
        method: 'POST',
        body: toCreateRequest(input),
        schema: transactionDtoSchema,
      }),
    );
  }

  async update(id: string, changes: TransactionChanges): Promise<Transaction> {
    return toTransaction(
      await this.call(`/v1/transactions/${id}`, {
        method: 'PATCH',
        body: toUpdateRequest(changes),
        schema: transactionDtoSchema,
      }),
    );
  }

  async delete(id: string): Promise<void> {
    await this.call(`/v1/transactions/${id}`, { method: 'DELETE', schema: z.undefined() });
  }

  async monthlySummary(householdId: string, period: YearMonth): Promise<MonthlySummary> {
    return toMonthlySummary(
      await this.call(`/v1/households/${householdId}/summary`, {
        schema: monthlySummaryDtoSchema,
        query: { month: toYearMonthString(period) },
      }),
    );
  }

  async dailyTotals(householdId: string, period: YearMonth): Promise<readonly DailyTotal[]> {
    return toDailyTotals(
      await this.call(`/v1/households/${householdId}/daily-totals`, {
        schema: dailyTotalsDtoSchema,
        query: { month: toYearMonthString(period) },
      }),
    );
  }

  private async call<S extends z.ZodType>(path: string, options: RequestOptions<S>) {
    const result = await this.http.request(path, options);
    if (!result.ok) throw toTransactionError(result.error);
    return result.value;
  }
}

export function toTransactionError(error: HttpError): TransactionError {
  if (isConnectivityError(error)) return new TransactionError('network');
  if (error.kind !== 'http') return new TransactionError('unknown');
  const code = problemCode(error);
  if (code === 'transaction-not-found' || code === 'household-not-found') {
    return new TransactionError('not-found', error.problem.detail);
  }
  if (error.status === 403) return new TransactionError('forbidden', error.problem.detail);
  if (error.status === 400 || error.status === 409 || error.status === 422) {
    return new TransactionError('invalid', error.problem.detail);
  }
  return new TransactionError('unknown', error.problem.detail);
}
