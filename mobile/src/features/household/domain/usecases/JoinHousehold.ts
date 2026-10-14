import type { Household } from '../Household';
import { HouseholdError } from '../HouseholdError';
import type { HouseholdRepository } from '../HouseholdRepository';
import { isValidInviteCode, normalizeInviteCode } from '../inviteCode';

/** Joins a household with the code a member shared. Malformed codes never reach the API. */
export class JoinHousehold {
  constructor(private readonly repository: HouseholdRepository) {}

  execute(code: string): Promise<Household> {
    if (!isValidInviteCode(code)) return Promise.reject(new HouseholdError('invalid-invite'));
    return this.repository.join(normalizeInviteCode(code));
  }
}
