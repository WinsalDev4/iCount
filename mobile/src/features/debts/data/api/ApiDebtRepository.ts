import {
  amortizationScheduleDtoSchema,
  debtDtoSchema,
  payoffStrategyResultDtoSchema,
} from '@icount/contracts';
import { z } from 'zod';

import type { Money } from '@/core/domain/Money';
import type { HttpError } from '@/core/network/HttpError';
import type { HttpClient, RequestOptions } from '@/core/network/httpClient';
import { isConnectivityError, problemCode } from '@/core/network/problemCode';

import type {
  AmortizationSchedule,
  Debt,
  DebtChanges,
  NewDebt,
  PayoffPlan,
  PayoffStrategy,
} from '../../domain/Debt';
import { DebtError } from '../../domain/DebtError';
import type { DebtRepository } from '../../domain/DebtRepository';
import {
  toAmortizationSchedule,
  toCreateDebtRequest,
  toDebt,
  toPayoffPlan,
  toUpdateDebtRequest,
} from './debtMapper';

/** DebtRepository over the API. `http` is the authenticated client. */
export class ApiDebtRepository implements DebtRepository {
  constructor(
    private readonly http: HttpClient,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async list(householdId: string): Promise<readonly Debt[]> {
    const debts = await this.call(`/v1/households/${householdId}/debts`, {
      schema: z.array(debtDtoSchema),
    });
    return debts.map(toDebt);
  }

  async getById(id: string): Promise<Debt | null> {
    try {
      return toDebt(await this.call(`/v1/debts/${id}`, { schema: debtDtoSchema }));
    } catch (error) {
      if (error instanceof DebtError && error.reason === 'not-found') return null;
      throw error;
    }
  }

  async create(input: NewDebt): Promise<Debt> {
    return toDebt(
      await this.call(`/v1/households/${input.householdId}/debts`, {
        method: 'POST',
        body: toCreateDebtRequest(input),
        schema: debtDtoSchema,
      }),
    );
  }

  async update(id: string, changes: DebtChanges): Promise<Debt> {
    return toDebt(
      await this.call(`/v1/debts/${id}`, {
        method: 'PATCH',
        body: toUpdateDebtRequest(changes),
        schema: debtDtoSchema,
      }),
    );
  }

  async delete(id: string): Promise<void> {
    await this.call(`/v1/debts/${id}`, { method: 'DELETE', schema: z.undefined() });
  }

  async schedule(id: string): Promise<AmortizationSchedule> {
    return toAmortizationSchedule(
      await this.call(`/v1/debts/${id}/schedule`, { schema: amortizationScheduleDtoSchema }),
    );
  }

  async payoffPlan(
    householdId: string,
    strategy: PayoffStrategy,
    extraMonthly: Money,
  ): Promise<PayoffPlan> {
    const plan = await this.call(`/v1/households/${householdId}/debts/strategy`, {
      schema: payoffStrategyResultDtoSchema,
      query: { strategy, extraMonthlyMinor: extraMonthly.amountMinor },
    });
    return toPayoffPlan(plan, this.now());
  }

  private async call<S extends z.ZodType>(path: string, options: RequestOptions<S>) {
    const result = await this.http.request(path, options);
    if (!result.ok) throw toDebtError(result.error);
    return result.value;
  }
}

export function toDebtError(error: HttpError): DebtError {
  if (isConnectivityError(error)) return new DebtError('network');
  if (error.kind !== 'http') return new DebtError('unknown');
  const code = problemCode(error);
  if (code === 'debt-not-found' || code === 'household-not-found') {
    return new DebtError('not-found', error.problem.detail);
  }
  if (error.status === 400 || error.status === 409 || error.status === 422) {
    return new DebtError('invalid', error.problem.detail);
  }
  return new DebtError('unknown', error.problem.detail);
}
