import type { Household, HouseholdRepository } from '../domain/household.js';
import { HouseholdNotFoundError } from '../domain/households.errors.js';

/**
 * Membership check shared by every module that works inside a household
 * (categories, transactions, budgets…). Non-members get a 404, never a 403.
 */
export class HouseholdAccess {
  constructor(private readonly households: HouseholdRepository) {}

  async requireMember(householdId: string, userId: string): Promise<Household> {
    const household = await this.households.findById(householdId);
    if (!household?.isMember(userId)) throw new HouseholdNotFoundError(householdId);
    return household;
  }
}
