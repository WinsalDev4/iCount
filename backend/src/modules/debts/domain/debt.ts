import {
  amortizationSchedule,
  type AmortizationSchedule,
  frenchInstallment,
  outstandingBalance,
  PaymentTooLowError,
  type ScheduleInput,
} from '@icount/finance';

import { DomainError } from '../../../shared/domain/domain-error.js';

export type DebtKind = 'car' | 'mortgage' | 'personal' | 'credit-card' | 'other';

export interface DebtProps {
  readonly id: string;
  readonly householdId: string;
  readonly name: string;
  readonly kind: DebtKind;
  readonly principalMinor: number;
  /** Nominal annual rate (TIN) in basis points. */
  readonly annualRateBps: number;
  /** APR (TAE), informative only. */
  readonly aprBps: number | null;
  readonly monthlyPaymentMinor: number;
  /** Date of the first instalment. */
  readonly startDate: string;
  readonly termMonths: number;
  readonly currency: string;
  readonly createdBy: string;
  readonly createdAt: Date;
}

export type EditableDebtFields = Partial<
  Pick<
    DebtProps,
    'name' | 'kind' | 'annualRateBps' | 'aprBps' | 'monthlyPaymentMinor' | 'termMonths'
  >
>;

/**
 * A loan with French amortisation (ADR-0015). Its figures (schedule, balance,
 * end date) are derived with @icount/finance, the same code the app runs offline.
 */
export class Debt {
  private constructor(private props: DebtProps) {}

  static create(
    fields: Omit<DebtProps, 'monthlyPaymentMinor'> & { monthlyPaymentMinor?: number },
  ): Debt {
    // The figures must be sound before the French instalment can be computed.
    checkFigures(fields);
    const debt = new Debt({
      ...fields,
      monthlyPaymentMinor:
        fields.monthlyPaymentMinor ??
        frenchInstallment(fields.principalMinor, fields.annualRateBps, fields.termMonths),
    });
    debt.validate();
    return debt;
  }

  static restore(props: DebtProps): Debt {
    return new Debt(props);
  }

  get snapshot(): DebtProps {
    return this.props;
  }

  get id(): string {
    return this.props.id;
  }

  edit(changes: EditableDebtFields): void {
    this.props = { ...this.props, ...changes };
    this.validate();
  }

  /** Input of the amortisation functions; the contractual term absorbs the rounding residual. */
  scheduleInput(): ScheduleInput {
    const { principalMinor, annualRateBps, monthlyPaymentMinor, startDate, termMonths } =
      this.props;
    const contractual =
      monthlyPaymentMinor === frenchInstallment(principalMinor, annualRateBps, termMonths);
    return {
      principalMinor,
      annualRateBps,
      paymentMinor: monthlyPaymentMinor,
      firstPaymentDate: startDate,
      ...(contractual ? { termMonths } : {}),
    };
  }

  schedule(): AmortizationSchedule {
    return amortizationSchedule(this.scheduleInput());
  }

  /** Balance owed on `date`, assuming the instalments are paid on time. */
  outstandingOn(date: string): number {
    return outstandingBalance(this.scheduleInput(), date);
  }

  private validate(): void {
    checkFigures(this.props);
    try {
      this.schedule();
    } catch (error) {
      if (error instanceof PaymentTooLowError) {
        throw new InvalidDebtError(
          'The monthly payment does not cover the interest: it would never end.',
        );
      }
      throw error;
    }
  }
}

function checkFigures({
  principalMinor,
  annualRateBps,
  aprBps,
  termMonths,
}: Pick<DebtProps, 'principalMinor' | 'annualRateBps' | 'aprBps' | 'termMonths'>): void {
  if (!Number.isSafeInteger(principalMinor) || principalMinor <= 0) {
    throw new InvalidDebtError('The amount borrowed must be a positive number of cents.');
  }
  if (!Number.isInteger(annualRateBps) || annualRateBps < 0 || (aprBps !== null && aprBps < 0)) {
    throw new InvalidDebtError('Rates must be non-negative basis points.');
  }
  if (!Number.isInteger(termMonths) || termMonths < 1) {
    throw new InvalidDebtError('The term must be at least one month.');
  }
}

export abstract class DebtRepository {
  abstract listForHousehold(householdId: string): Promise<Debt[]>;
  abstract findById(id: string): Promise<Debt | null>;
  abstract save(debt: Debt): Promise<void>;
  abstract delete(id: string): Promise<void>;
  /** Links a movement (category "loans") as a payment of the debt; false if already linked. */
  abstract linkPayment(debtId: string, transactionId: string): Promise<boolean>;
  abstract unlinkPayment(debtId: string, transactionId: string): Promise<void>;
  abstract paymentTransactionIds(debtId: string): Promise<string[]>;
}

export class InvalidDebtError extends DomainError {
  readonly kind = 'invalid';
  readonly code = 'invalid-debt';
  readonly title = 'Invalid debt';
}

export class DebtNotFoundError extends DomainError {
  readonly kind = 'not_found';
  readonly code = 'debt-not-found';
  readonly title = 'Debt not found';

  constructor(id: string) {
    super(`Debt ${id} does not exist or you cannot see it.`);
  }
}

export class InvalidDebtPaymentError extends DomainError {
  readonly kind = 'invalid';
  readonly code = 'invalid-debt-payment';
  readonly title = 'This movement cannot pay this debt';
}
