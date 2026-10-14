import type { HouseholdId } from '@/core/domain/Ids';

import type { Invitation } from '../Household';
import type { HouseholdRepository } from '../HouseholdRepository';

/** A fresh single-use code (8 characters, 48 h) to share with whoever should join. */
export class CreateInvite {
  constructor(private readonly repository: HouseholdRepository) {}

  execute(householdId: HouseholdId): Promise<Invitation> {
    return this.repository.createInvite(householdId);
  }
}
