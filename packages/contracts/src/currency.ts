import { z } from 'zod';

/** ISO 4217 codes the product supports. Mirrors `CurrencyCode` in mobile/src/core/domain/Money.ts. */
export const currencyCodeSchema = z.enum(['EUR', 'USD', 'GBP', 'MXN']);

export type CurrencyCode = z.infer<typeof currencyCodeSchema>;
