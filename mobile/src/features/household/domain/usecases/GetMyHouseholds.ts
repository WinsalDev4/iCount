import type { Household } from '../Household';
import type { HouseholdRepository } from '../HouseholdRepository';

/** The households the signed-in user belongs to (empty until they create or join one). */
export class GetMyHouseholds {
  constructor(private readonly repository: HouseholdRepository) {}

  execute(): Promise<readonly Household[]> {
    return this.repository.getMine();
  }
}
