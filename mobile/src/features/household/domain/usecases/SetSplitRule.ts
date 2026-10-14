import type { HouseholdId } from '@/core/domain/Ids';

import type { Household } from '../Household';
import { HouseholdError } from '../HouseholdError';
import type { HouseholdRepository } from '../HouseholdRepository';
import { isValidShares, type SplitRule } from '../SplitRule';

/** Admin-only. A custom rule must have valid shares in every category it lists. */
export class SetSplitRule {
  constructor(private readonly repository: HouseholdRepository) {}

  execute(householdId: HouseholdId, rule: SplitRule): Promise<Household> {
    if (rule.kind === 'custom') {
      const seen = new Set<string>();
      for (const category of rule.categories) {
        const duplicated = seen.has(category.categoryId);
        seen.add(category.categoryId);
        if (duplicated || !isValidShares(category.shares)) {
          return Promise.reject(new HouseholdError('invalid-split-rule'));
        }
      }
    }
    return this.repository.setSplitRule(householdId, rule);
  }
}
