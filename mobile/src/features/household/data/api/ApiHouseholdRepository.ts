import { householdDtoSchema, invitationDtoSchema } from '@icount/contracts';
import { z } from 'zod';

import type { HouseholdId } from '@/core/domain/Ids';
import type { Money } from '@/core/domain/Money';
import type { HttpError } from '@/core/network/HttpError';
import type { HttpClient } from '@/core/network/httpClient';
import { isConnectivityError, problemCode } from '@/core/network/problemCode';

import type { Household, Invitation } from '../../domain/Household';
import { HouseholdError, type HouseholdErrorReason } from '../../domain/HouseholdError';
import type { CreateHouseholdInput, HouseholdRepository } from '../../domain/HouseholdRepository';
import type { SplitRule } from '../../domain/SplitRule';
import { fromSplitRule, toHousehold, toInvitation } from './householdMapper';

/** HouseholdRepository over the API. `http` is the authenticated client. */
export class ApiHouseholdRepository implements HouseholdRepository {
  constructor(private readonly http: HttpClient) {}

  async getMine(): Promise<readonly Household[]> {
    const households = await this.call('/v1/households', { schema: z.array(householdDtoSchema) });
    return households.map(toHousehold);
  }

  async create(input: CreateHouseholdInput): Promise<Household> {
    return toHousehold(
      await this.call('/v1/households', {
        method: 'POST',
        body: input,
        schema: householdDtoSchema,
      }),
    );
  }

  async createInvite(householdId: HouseholdId): Promise<Invitation> {
    return toInvitation(
      await this.call(`/v1/households/${householdId}/invitations`, {
        method: 'POST',
        schema: invitationDtoSchema,
      }),
    );
  }

  async join(code: string): Promise<Household> {
    return toHousehold(
      await this.call('/v1/households/join', {
        method: 'POST',
        body: { code },
        schema: householdDtoSchema,
      }),
    );
  }

  async setSplitRule(householdId: HouseholdId, rule: SplitRule): Promise<Household> {
    return toHousehold(
      await this.call(`/v1/households/${householdId}/split-rule`, {
        method: 'PUT',
        body: { splitRule: fromSplitRule(rule) },
        schema: householdDtoSchema,
      }),
    );
  }

  async setMyIncome(householdId: HouseholdId, monthlyIncome: Money): Promise<Household> {
    return toHousehold(
      await this.call(`/v1/households/${householdId}/members/me/income`, {
        method: 'PUT',
        body: {
          monthlyIncome: {
            amountMinor: monthlyIncome.amountMinor,
            currency: monthlyIncome.currency,
          },
        },
        schema: householdDtoSchema,
      }),
    );
  }

  private async call<S extends z.ZodType>(
    path: string,
    options: Parameters<HttpClient['request']>[1] & { schema: S },
  ): Promise<z.output<S>> {
    const result = await this.http.request(path, options);
    if (!result.ok) throw toHouseholdError(result.error);
    return result.value;
  }
}

const REASON_BY_CODE: Record<string, HouseholdErrorReason> = {
  'invalid-invite': 'invalid-invite',
  'expired-invite': 'expired-invite',
  'already-member': 'already-member',
  'household-not-found': 'not-found',
  'not-household-admin': 'forbidden',
  'personal-household': 'forbidden',
  'invalid-split-rule': 'invalid-split-rule',
};

export function toHouseholdError(error: HttpError): HouseholdError {
  if (isConnectivityError(error)) return new HouseholdError('network');
  const code = problemCode(error);
  const reason = (code ? REASON_BY_CODE[code] : undefined) ?? 'unknown';
  return new HouseholdError(reason, error.kind === 'http' ? error.problem.detail : undefined);
}
