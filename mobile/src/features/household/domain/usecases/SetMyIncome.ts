import type { HouseholdId } from '@/core/domain/Ids';
import type { Money } from '@/core/domain/Money';

import type { Household } from '../Household';
import type { HouseholdRepository } from '../HouseholdRepository';

/** Declares the signed-in member's monthly income (used by the income-proportional rule). */
export class SetMyIncome {
  constructor(private readonly repository: HouseholdRepository) {}

  execute(householdId: HouseholdId, monthlyIncome: Money): Promise<Household> {
    if (monthlyIncome.isNegative()) {
      return Promise.reject(new RangeError('Monthly income cannot be negative'));
    }
    return this.repository.setMyIncome(householdId, monthlyIncome);
  }
}
