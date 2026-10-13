import type {
  NewRecurringPayment,
  RecurringPayment,
  RecurringPaymentChanges,
  UpcomingDue,
} from './RecurringPayment';

/**
 * Port for recurring payments (bills, loan instalments, subscriptions).
 * Implementations: InMemory (B-4.3) and ApiRecurringPaymentRepository (A-4.3).
 * Failures reject with `RecurringError`.
 */
export interface RecurringPaymentRepository {
  list(householdId: string): Promise<readonly RecurringPayment[]>;
  create(input: NewRecurringPayment): Promise<RecurringPayment>;
  update(id: string, changes: RecurringPaymentChanges): Promise<RecurringPayment>;
  delete(id: string): Promise<void>;
  /** Occurrences due between two days, both inclusive, earliest first. */
  upcoming(householdId: string, from: Date, to: Date): Promise<readonly UpcomingDue[]>;
}
