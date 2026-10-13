import { z } from 'zod';

import { currencyCodeSchema } from './currency.ts';

/**
 * Money on the wire (ADR-0007): integer minor units (cents) + currency. Never a
 * decimal number: `{ amountMinor: 1050, currency: 'EUR' }` is 10,50 €.
 * Negative amounts are allowed (balances, debts); the sign of a movement is
 * given by its type, not by this DTO.
 */
export const moneyDtoSchema = z.object({
  /** Safe integer (|n| ≤ 2^53 − 1), same rule as `Money` in the app. */
  amountMinor: z.int(),
  currency: currencyCodeSchema,
});

export type MoneyDto = z.infer<typeof moneyDtoSchema>;
