import { budgetDtoSchema } from '@icount/contracts';
import { z } from 'zod';

import type { Money } from '@/core/domain/Money';
import type { YearMonth } from '@/core/domain/YearMonth';
import type { HttpError } from '@/core/network/HttpError';
import type { HttpClient, RequestOptions } from '@/core/network/httpClient';
import { isConnectivityError, problemCode } from '@/core/network/problemCode';

import type { Budget, NewBudget } from '../../domain/Budget';
import { BudgetError } from '../../domain/BudgetError';
import type { BudgetRepository } from '../../domain/BudgetRepository';
import { toYearMonthString } from '../../../transactions/data/api/transactionMapper';
import { fromMoney, toBudget, toCreateBudgetRequest } from './budgetMapper';

/** BudgetRepository over the API. `http` is the authenticated client. */
export class ApiBudgetRepository implements BudgetRepository {
  constructor(private readonly http: HttpClient) {}

  async list(householdId: string, month: YearMonth): Promise<readonly Budget[]> {
    const budgets = await this.call(`/v1/households/${householdId}/budgets`, {
      schema: z.array(budgetDtoSchema),
      query: { month: toYearMonthString(month) },
    });
    return budgets.map(toBudget);
  }

  async create(input: NewBudget): Promise<Budget> {
    return toBudget(
      await this.call(`/v1/households/${input.householdId}/budgets`, {
        method: 'POST',
        body: toCreateBudgetRequest(input),
        schema: budgetDtoSchema,
      }),
    );
  }

  async updateLimit(id: string, limit: Money): Promise<Budget> {
    return toBudget(
      await this.call(`/v1/budgets/${id}`, {
        method: 'PATCH',
        body: { limit: fromMoney(limit) },
        schema: budgetDtoSchema,
      }),
    );
  }

  async delete(id: string): Promise<void> {
    await this.call(`/v1/budgets/${id}`, { method: 'DELETE', schema: z.undefined() });
  }

  async moveAmount(
    fromId: string,
    toId: string,
    amount: Money,
  ): Promise<readonly [Budget, Budget]> {
    const [from, to] = await this.call('/v1/budgets/move', {
      method: 'POST',
      body: { fromBudgetId: fromId, toBudgetId: toId, amount: fromMoney(amount) },
      schema: z.tuple([budgetDtoSchema, budgetDtoSchema]),
    });
    return [toBudget(from), toBudget(to)];
  }

  private async call<S extends z.ZodType>(path: string, options: RequestOptions<S>) {
    const result = await this.http.request(path, options);
    if (!result.ok) throw toBudgetError(result.error);
    return result.value;
  }
}

export function toBudgetError(error: HttpError): BudgetError {
  if (isConnectivityError(error)) return new BudgetError('network');
  if (error.kind !== 'http') return new BudgetError('unknown');
  const detail = error.problem.detail;
  switch (problemCode(error)) {
    case 'budget-not-found':
    case 'household-not-found':
      return new BudgetError('not-found', detail);
    case 'duplicate-budget':
      return new BudgetError('duplicate', detail);
    case 'insufficient-amount':
      return new BudgetError('insufficient-amount', detail);
  }
  if (error.status === 400 || error.status === 409 || error.status === 422) {
    return new BudgetError('invalid', detail);
  }
  return new BudgetError('unknown', detail);
}
