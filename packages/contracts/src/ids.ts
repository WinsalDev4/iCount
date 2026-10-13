import { z } from 'zod';

/**
 * Branded identifiers: all are UUID strings at runtime, but the compiler stops
 * you from passing a `HouseholdId` where a `UserId` is expected.
 * Kotlin analogy: `@JvmInline value class UserId(val value: String)`.
 */
export const userIdSchema = z.uuid().brand<'UserId'>();
export const householdIdSchema = z.uuid().brand<'HouseholdId'>();
export const transactionIdSchema = z.uuid().brand<'TransactionId'>();

export type UserId = z.infer<typeof userIdSchema>;
export type HouseholdId = z.infer<typeof householdIdSchema>;
export type TransactionId = z.infer<typeof transactionIdSchema>;

export const budgetIdSchema = z.uuid().brand<'BudgetId'>();
export const debtIdSchema = z.uuid().brand<'DebtId'>();
export const recurringPaymentIdSchema = z.uuid().brand<'RecurringPaymentId'>();

export type BudgetId = z.infer<typeof budgetIdSchema>;
export type DebtId = z.infer<typeof debtIdSchema>;
export type RecurringPaymentId = z.infer<typeof recurringPaymentIdSchema>;
