import type { CategoryId } from '@/core/domain/Category';
import type { UserId } from '@/core/domain/Ids';
import type { Money } from '@/core/domain/Money';

/**
 * When it falls due. `dayOfMonth` 31 means "last day" in shorter months.
 * Yearly rules also need `monthOfYear` (1–12).
 */
export interface RecurrenceRule {
  readonly unit: 'month' | 'year';
  readonly interval: number;
  readonly dayOfMonth: number;
  readonly monthOfYear?: number;
}

export type RecurringKind = 'bill' | 'loan' | 'subscription' | 'income' | 'other';

export interface RecurringPayment {
  readonly id: string;
  readonly householdId: string;
  readonly name: string;
  readonly kind: RecurringKind;
  readonly type: 'income' | 'expense';
  readonly amount: Money;
  readonly categoryId: CategoryId;
  readonly rule: RecurrenceRule;
  readonly startDate: Date;
  /** Null = open-ended. */
  readonly endDate: Date | null;
  /** Null when there are no more occurrences. */
  readonly nextDueDate: Date | null;
  readonly payerId: UserId;
  readonly shared: boolean;
  /** Set for loan instalments linked to a debt. */
  readonly debtId: string | null;
}

export interface NewRecurringPayment {
  readonly householdId: string;
  readonly name: string;
  readonly kind: RecurringKind;
  readonly type: 'income' | 'expense';
  readonly amount: Money;
  readonly categoryId: CategoryId;
  readonly rule: RecurrenceRule;
  readonly startDate: Date;
  readonly endDate?: Date;
  /** Defaults to the signed-in member. */
  readonly payerId?: UserId;
  readonly shared: boolean;
  readonly debtId?: string;
}

export type RecurringPaymentChanges = Partial<
  Pick<
    RecurringPayment,
    'name' | 'kind' | 'amount' | 'categoryId' | 'rule' | 'endDate' | 'payerId' | 'shared'
  >
>;

/** One future occurrence, for the calendar and reminders. */
export interface UpcomingDue {
  readonly recurringPaymentId: string;
  readonly name: string;
  readonly dueDate: Date;
  readonly type: 'income' | 'expense';
  readonly amount: Money;
  readonly categoryId: CategoryId;
}
