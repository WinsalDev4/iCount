import { addMonths, compareLocalDates, type LocalDate, parseLocalDate } from './dates.ts';
import { assertCents, roundHalfAwayFromZero } from './rounding.ts';

/** Safety net for loops: no consumer loan lasts more than 100 years. */
export const MAX_PERIODS = 1_200;

/** Annual nominal rate (TIN) in basis points → monthly rate as a fraction. 690 → 0.00575. */
export function monthlyRate(annualRateBps: number): number {
  if (!Number.isInteger(annualRateBps) || annualRateBps < 0) {
    throw new RangeError(`annualRateBps must be a non-negative integer, got ${annualRateBps}`);
  }
  return annualRateBps / 10_000 / 12;
}

/**
 * French amortisation instalment (constant payment):
 *   A = P · i / (1 − (1 + i)^−n)     and     A = P / n when i = 0
 * The only place with fractions of a cent; the result is rounded once.
 */
export function frenchInstallment(
  principalMinor: number,
  annualRateBps: number,
  termMonths: number,
): number {
  assertCents(principalMinor, 'principalMinor');
  if (!Number.isInteger(termMonths) || termMonths < 1) {
    throw new RangeError(`termMonths must be a positive integer, got ${termMonths}`);
  }
  const i = monthlyRate(annualRateBps);
  const raw =
    i === 0 ? principalMinor / termMonths : (principalMinor * i) / (1 - (1 + i) ** -termMonths);
  return roundHalfAwayFromZero(raw);
}

/** Interest of one month on a balance, rounded to the cent (once per period). */
export function periodInterest(balanceMinor: number, annualRateBps: number): number {
  return roundHalfAwayFromZero(balanceMinor * monthlyRate(annualRateBps));
}

export interface AmortizationRow {
  readonly period: number;
  readonly date: LocalDate;
  readonly paymentMinor: number;
  readonly interestMinor: number;
  readonly principalMinor: number;
  /** Balance after this payment. */
  readonly balanceMinor: number;
}

export interface AmortizationSchedule {
  readonly rows: readonly AmortizationRow[];
  readonly totalInterestMinor: number;
  readonly totalPaidMinor: number;
  /** Date of the last payment (null if nothing was owed). */
  readonly payoffDate: LocalDate | null;
}

export interface ScheduleInput {
  /** Balance owed right before the first payment of the schedule. */
  readonly principalMinor: number;
  readonly annualRateBps: number;
  /** Regular instalment. */
  readonly paymentMinor: number;
  /** Date of the first payment; the next ones keep its day of month. */
  readonly firstPaymentDate: LocalDate;
  /** Paid on top of every instalment, straight to principal. */
  readonly extraMonthlyMinor?: number;
  /**
   * Contractual number of instalments, when the payment comes from
   * `frenchInstallment(principal, rate, termMonths)`: instalment n then absorbs the
   * rounding residual (as banks do) instead of leaving a tiny extra one.
   */
  readonly termMonths?: number;
}

export class PaymentTooLowError extends RangeError {
  constructor(paymentMinor: number, interestMinor: number) {
    super(
      `A payment of ${paymentMinor} does not cover the monthly interest of ${interestMinor}: the debt would never end`,
    );
    this.name = 'PaymentTooLowError';
  }
}

/**
 * Month-by-month schedule (cuadro de amortización). Every period:
 * interest = round(balance · i); principal = payment − interest; and the last
 * payment absorbs the residual so the balance ends at exactly 0.
 */
export function amortizationSchedule(input: ScheduleInput): AmortizationSchedule {
  const extra = input.extraMonthlyMinor ?? 0;
  assertCents(input.principalMinor, 'principalMinor');
  assertCents(input.paymentMinor, 'paymentMinor');
  assertCents(extra, 'extraMonthlyMinor');
  const anchorDay = parseLocalDate(input.firstPaymentDate).day;

  const rows: AmortizationRow[] = [];
  let balance = input.principalMinor;
  let totalInterest = 0;
  let totalPaid = 0;

  while (balance > 0) {
    if (rows.length >= MAX_PERIODS) throw new RangeError('Schedule longer than MAX_PERIODS');
    const interest = periodInterest(balance, input.annualRateBps);
    const regular = input.paymentMinor + extra;
    if (regular <= interest) throw new PaymentTooLowError(regular, interest);

    const isLastOfTerm = input.termMonths !== undefined && rows.length + 1 >= input.termMonths;
    const payment = isLastOfTerm ? balance + interest : Math.min(regular, balance + interest);
    const principal = payment - interest;
    balance -= principal;
    totalInterest += interest;
    totalPaid += payment;
    rows.push({
      period: rows.length + 1,
      date: addMonths(input.firstPaymentDate, rows.length, anchorDay),
      paymentMinor: payment,
      interestMinor: interest,
      principalMinor: principal,
      balanceMinor: balance,
    });
  }

  return {
    rows,
    totalInterestMinor: totalInterest,
    totalPaidMinor: totalPaid,
    payoffDate: rows.at(-1)?.date ?? null,
  };
}

/** Balance still owed on `asOf`, after every payment dated on or before it. */
export function outstandingBalance(input: ScheduleInput, asOf: LocalDate): number {
  if (compareLocalDates(asOf, input.firstPaymentDate) < 0) return input.principalMinor;
  const { rows } = amortizationSchedule(input);
  const lastPaid = rows.findLast((row) => compareLocalDates(row.date, asOf) <= 0);
  return lastPaid ? lastPaid.balanceMinor : input.principalMinor;
}

export interface PayoffSummary {
  readonly months: number;
  readonly totalInterestMinor: number;
  readonly payoffDate: LocalDate | null;
}

export interface ExtraPaymentSimulation {
  readonly baseline: PayoffSummary;
  readonly withExtra: PayoffSummary;
  readonly monthsSaved: number;
  readonly interestSavedMinor: number;
}

/** "What if I pay X more every month?" — the debt detail chips (+50 / +100 / +200 €). */
export function simulateExtraPayment(
  input: Omit<ScheduleInput, 'extraMonthlyMinor'>,
  extraMonthlyMinor: number,
): ExtraPaymentSimulation {
  const summarize = (schedule: AmortizationSchedule): PayoffSummary => ({
    months: schedule.rows.length,
    totalInterestMinor: schedule.totalInterestMinor,
    payoffDate: schedule.payoffDate,
  });
  const baseline = summarize(amortizationSchedule(input));
  const withExtra = summarize(amortizationSchedule({ ...input, extraMonthlyMinor }));
  return {
    baseline,
    withExtra,
    monthsSaved: baseline.months - withExtra.months,
    interestSavedMinor: baseline.totalInterestMinor - withExtra.totalInterestMinor,
  };
}
