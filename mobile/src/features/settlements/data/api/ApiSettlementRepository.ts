import { householdBalanceDtoSchema, settlementDtoSchema } from '@icount/contracts';
import { z } from 'zod';

import type { HttpError } from '@/core/network/HttpError';
import type { HttpClient, RequestOptions } from '@/core/network/httpClient';
import { isConnectivityError } from '@/core/network/problemCode';

import { toLocalDate } from '../../../transactions/data/api/transactionMapper';
import type {
  BalancePeriod,
  HouseholdBalance,
  NewSettlement,
  Settlement,
} from '../../domain/Settlement';
import { SettlementError } from '../../domain/SettlementError';
import type { SettlementRepository } from '../../domain/SettlementRepository';
import { toCreateSettlementRequest, toHouseholdBalance, toSettlement } from './settlementMapper';

/** SettlementRepository over the API. `http` is the authenticated client. */
export class ApiSettlementRepository implements SettlementRepository {
  constructor(private readonly http: HttpClient) {}

  async balance(householdId: string, period: BalancePeriod = {}): Promise<HouseholdBalance> {
    return toHouseholdBalance(
      await this.call(`/v1/households/${householdId}/balance`, {
        schema: householdBalanceDtoSchema,
        query: {
          from: period.from && toLocalDate(period.from),
          to: period.to && toLocalDate(period.to),
        },
      }),
    );
  }

  async list(householdId: string): Promise<readonly Settlement[]> {
    const settlements = await this.call(`/v1/households/${householdId}/settlements`, {
      schema: z.array(settlementDtoSchema),
    });
    return settlements.map(toSettlement);
  }

  async create(input: NewSettlement): Promise<Settlement> {
    return toSettlement(
      await this.call(`/v1/households/${input.householdId}/settlements`, {
        method: 'POST',
        body: toCreateSettlementRequest(input),
        schema: settlementDtoSchema,
      }),
    );
  }

  private async call<S extends z.ZodType>(path: string, options: RequestOptions<S>) {
    const result = await this.http.request(path, options);
    if (!result.ok) throw toSettlementError(result.error);
    return result.value;
  }
}

export function toSettlementError(error: HttpError): SettlementError {
  if (isConnectivityError(error)) return new SettlementError('network');
  if (error.kind !== 'http') return new SettlementError('unknown');
  const detail = error.problem.detail;
  // A household the user cannot see answers 404, like one that does not exist.
  if (error.status === 403 || error.status === 404) return new SettlementError('forbidden', detail);
  if (error.status === 400 || error.status === 422) return new SettlementError('invalid', detail);
  return new SettlementError('unknown', detail);
}
