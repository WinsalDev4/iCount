import { addDays, nextOccurrence, type RecurrenceRule } from '@icount/finance';

import { DomainError } from '../../../shared/domain/domain-error.js';
import type { Household } from '../../households/domain/household.js';

export type RecurringKind = 'bill' | 'loan' | 'subscription' | 'income' | 'other';

export interface RecurringPaymentProps {
  readonly id: string;
  readonly householdId: string;
  readonly name: string;
  readonly kind: RecurringKind;
  readonly type: 'income' | 'expense';
  readonly amountMinor: number;
  readonly currency: string;
  readonly categoryId: string;
  readonly rule: RecurrenceRule;
  readonly startDate: string;
  readonly endDate: string | null;
  /** Next date the job will turn into a movement; null when the series has ended. */
  readonly nextDueDate: string | null;
  readonly payerId: string;
  readonly shared: boolean;
  readonly debtId: string | null;
  readonly createdBy: string;
  readonly createdAt: Date;
}

export type EditableRecurringFields = Partial<
  Pick<
    RecurringPaymentProps,
    'name' | 'kind' | 'amountMinor' | 'categoryId' | 'rule' | 'endDate' | 'payerId' | 'shared'
  >
>;

/** A bill, instalment or subscription that repeats (pagos recurrentes). */
export class RecurringPayment {
  private constructor(private props: RecurringPaymentProps) {}

  static create(
    household: Household,
    fields: Omit<RecurringPaymentProps, 'householdId' | 'nextDueDate'>,
    today: string,
  ): RecurringPayment {
    const payment = new RecurringPayment({
      ...fields,
      householdId: household.id,
      nextDueDate: null,
    });
    payment.validate(household);
    // Created today with a start in the past: past dates are not back-filled.
    payment.props = {
      ...payment.props,
      nextDueDate: payment.nextOnOrAfter(maxDate(fields.startDate, today)),
    };
    return payment;
  }

  static restore(props: RecurringPaymentProps): RecurringPayment {
    return new RecurringPayment(props);
  }

  get snapshot(): RecurringPaymentProps {
    return this.props;
  }

  get id(): string {
    return this.props.id;
  }

  edit(household: Household, changes: EditableRecurringFields, today: string): void {
    this.props = { ...this.props, ...changes };
    this.validate(household);
    if (changes.rule !== undefined || changes.endDate !== undefined) {
      this.props = {
        ...this.props,
        nextDueDate: this.nextOnOrAfter(maxDate(this.props.startDate, today)),
      };
    }
  }

  /** After materialising `dueDate`, moves on to the following occurrence. */
  advancePast(dueDate: string): void {
    this.props = { ...this.props, nextDueDate: this.nextOnOrAfter(addDays(dueDate, 1)) };
  }

  private nextOnOrAfter(date: string): string | null {
    return nextOccurrence(this.props.rule, this.props.startDate, this.props.endDate, date);
  }

  private validate(household: Household): void {
    const { amountMinor, payerId, shared, endDate, startDate } = this.props;
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
      throw new InvalidRecurringPaymentError('The amount must be a positive number of cents.');
    }
    if (!household.isMember(payerId)) {
      throw new InvalidRecurringPaymentError(`${payerId} is not a member of this household.`);
    }
    if (shared && household.kind === 'personal') {
      throw new InvalidRecurringPaymentError('Personal households do not share expenses.');
    }
    if (endDate !== null && endDate < startDate) {
      throw new InvalidRecurringPaymentError('The end date cannot be before the start date.');
    }
  }
}

function maxDate(a: string, b: string): string {
  return a > b ? a : b;
}

export abstract class RecurringPaymentRepository {
  abstract listForHousehold(householdId: string): Promise<RecurringPayment[]>;
  abstract findById(id: string): Promise<RecurringPayment | null>;
  abstract save(payment: RecurringPayment): Promise<void>;
  abstract delete(id: string): Promise<void>;
  /** Every series with a due date on or before `date`, in any household. */
  abstract findDue(date: string): Promise<RecurringPayment[]>;
  /**
   * Claims the occurrence of `dueDate`. False if it was already claimed: this is
   * what makes the daily job idempotent (the primary key decides, even across servers).
   */
  abstract claimOccurrence(recurringPaymentId: string, dueDate: string): Promise<boolean>;
  /** Links a claimed occurrence to the movement created for it. */
  abstract linkOccurrence(
    recurringPaymentId: string,
    dueDate: string,
    transactionId: string,
  ): Promise<void>;
}

export class InvalidRecurringPaymentError extends DomainError {
  readonly kind = 'invalid';
  readonly code = 'invalid-recurring-payment';
  readonly title = 'Invalid recurring payment';
}

export class RecurringPaymentNotFoundError extends DomainError {
  readonly kind = 'not_found';
  readonly code = 'recurring-payment-not-found';
  readonly title = 'Recurring payment not found';

  constructor(id: string) {
    super(`Recurring payment ${id} does not exist or you cannot see it.`);
  }
}
