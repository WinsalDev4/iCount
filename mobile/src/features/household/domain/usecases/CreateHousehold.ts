import type { CurrencyCode } from '@/core/domain/Money';

import type { Household, HouseholdKind } from '../Household';
import { isValidHouseholdName, normalizeHouseholdName } from '../householdName';
import type { HouseholdRepository } from '../HouseholdRepository';

export interface CreateHouseholdCommand {
  readonly name: string;
  readonly kind: HouseholdKind;
  readonly currency?: CurrencyCode;
}

/** Creates a personal or shared economy; the creator becomes its admin. */
export class CreateHousehold {
  constructor(
    private readonly repository: HouseholdRepository,
    private readonly defaultCurrency: CurrencyCode = 'EUR',
  ) {}

  execute({ name, kind, currency }: CreateHouseholdCommand): Promise<Household> {
    // The screens never let this through (the button stays disabled); this is the safety net.
    if (!isValidHouseholdName(name)) {
      return Promise.reject(new RangeError('Household name must have 1 to 60 characters'));
    }
    return this.repository.create({
      name: normalizeHouseholdName(name),
      kind,
      currency: currency ?? this.defaultCurrency,
    });
  }
}
