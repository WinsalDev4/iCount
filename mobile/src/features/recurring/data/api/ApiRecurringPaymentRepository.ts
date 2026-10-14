import { recurringPaymentDtoSchema, upcomingDueDtoSchema } from '@icount/contracts';
import { z } from 'zod';

import type { HttpError } from '@/core/network/HttpError';
import type { HttpClient, RequestOptions } from '@/core/network/httpClient';
import { isConnectivityError, problemCode } from '@/core/network/problemCode';

import { toLocalDate } from '../../../transactions/data/api/transactionMapper';
import { RecurringError } from '../../domain/RecurringError';
import type {
  NewRecurringPayment,
  RecurringPayment,
  RecurringPaymentChanges,
  UpcomingDue,
} from '../../domain/RecurringPayment';
import type { RecurringPaymentRepository } from '../../domain/RecurringPaymentRepository';
import {
  toCreateRecurringRequest,
  toRecurringPayment,
  toUpcomingDue,
  toUpdateRecurringRequest,
} from './recurringMapper';

/** RecurringPaymentRepository over the API. `http` is the authenticated client. */
export class ApiRecurringPaymentRepository implements RecurringPaymentRepository {
  constructor(private readonly http: HttpClient) {}

  async list(householdId: string): Promise<readonly RecurringPayment[]> {
    const payments = await this.call(`/v1/households/${householdId}/recurring`, {
      schema: z.array(recurringPaymentDtoSchema),
    });
    return payments.map(toRecurringPayment);
  }

  async create(input: NewRecurringPayment): Promise<RecurringPayment> {
    return toRecurringPayment(
      await this.call(`/v1/households/${input.householdId}/recurring`, {
        method: 'POST',
        body: toCreateRecurringRequest(input),
        schema: recurringPaymentDtoSchema,
      }),
    );
  }

  async update(id: string, changes: RecurringPaymentChanges): Promise<RecurringPayment> {
    return toRecurringPayment(
      await this.call(`/v1/recurring/${id}`, {
        method: 'PATCH',
        body: toUpdateRecurringRequest(changes),
        schema: recurringPaymentDtoSchema,
      }),
    );
  }

  async delete(id: string): Promise<void> {
    await this.call(`/v1/recurring/${id}`, { method: 'DELETE', schema: z.undefined() });
  }

  async upcoming(householdId: string, from: Date, to: Date): Promise<readonly UpcomingDue[]> {
    const dues = await this.call(`/v1/households/${householdId}/recurring/upcoming`, {
      schema: z.array(upcomingDueDtoSchema),
      query: { from: toLocalDate(from), to: toLocalDate(to) },
    });
    return dues.map(toUpcomingDue);
  }

  private async call<S extends z.ZodType>(path: string, options: RequestOptions<S>) {
    const result = await this.http.request(path, options);
    if (!result.ok) throw toRecurringError(result.error);
    return result.value;
  }
}

export function toRecurringError(error: HttpError): RecurringError {
  if (isConnectivityError(error)) return new RecurringError('network');
  if (error.kind !== 'http') return new RecurringError('unknown');
  const code = problemCode(error);
  if (code === 'recurring-payment-not-found' || code === 'household-not-found') {
    return new RecurringError('not-found', error.problem.detail);
  }
  if (error.status === 400 || error.status === 409 || error.status === 422) {
    return new RecurringError('invalid', error.problem.detail);
  }
  return new RecurringError('unknown', error.problem.detail);
}
