import { MAX_PERIODS, PaymentTooLowError, periodInterest } from './amortization.ts';
import { addMonths, type LocalDate, parseLocalDate } from './dates.ts';
import { assertCents } from './rounding.ts';

export type PayoffStrategy = 'avalanche' | 'snowball';

export interface DebtInput {
  readonly id: string;
  readonly balanceMinor: number;
  readonly annualRateBps: number;
  /** Contractual instalment; always paid while the debt is alive. */
  readonly minimumPaymentMinor: number;
}

export interface DebtPayoff {
  readonly id: string;
  /** Priority given by the strategy (1 = receives the extra first). */
  readonly order: number;
  readonly payoffDate: LocalDate;
  readonly months: number;
  readonly interestPaidMinor: number;
}

export interface PayoffPlan {
  readonly strategy: PayoffStrategy;
  readonly extraMonthlyMinor: number;
  readonly debts: readonly DebtPayoff[];
  readonly totalInterestMinor: number;
  readonly debtFreeDate: LocalDate | null;
  readonly months: number;
}

/**
 * Avalanche: highest rate first (minimises interest).
 * Snowball: smallest balance first (quick wins).
 * Ties fall back to the other criterion and then to the id, so the plan is deterministic.
 */
export function priorityOrder(debts: readonly DebtInput[], strategy: PayoffStrategy): DebtInput[] {
  const byId = (a: DebtInput, b: DebtInput) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return [...debts].sort((a, b) =>
    strategy === 'avalanche'
      ? b.annualRateBps - a.annualRateBps || a.balanceMinor - b.balanceMinor || byId(a, b)
      : a.balanceMinor - b.balanceMinor || b.annualRateBps - a.annualRateBps || byId(a, b),
  );
}

/**
 * Month by month, with a constant monthly budget = Σ minimum payments + extra:
 * 1. every alive debt accrues interest and gets its minimum payment;
 * 2. everything left (the extra plus the minimums of debts already paid off —
 *    the "rollover") goes to the alive debt with the highest priority, and any
 *    remainder after paying it off flows to the next one.
 */
export function payoffPlan(
  debts: readonly DebtInput[],
  strategy: PayoffStrategy,
  extraMonthlyMinor: number,
  firstPaymentDate: LocalDate,
): PayoffPlan {
  assertCents(extraMonthlyMinor, 'extraMonthlyMinor');
  if (extraMonthlyMinor < 0) throw new RangeError('extraMonthlyMinor cannot be negative');
  for (const debt of debts) {
    assertCents(debt.balanceMinor, `${debt.id}.balanceMinor`);
    assertCents(debt.minimumPaymentMinor, `${debt.id}.minimumPaymentMinor`);
  }

  const order = priorityOrder(debts, strategy);
  const anchorDay = parseLocalDate(firstPaymentDate).day;
  const budget = debts.reduce((sum, debt) => sum + debt.minimumPaymentMinor, extraMonthlyMinor);
  const state = new Map(
    order.map((debt) => [
      debt.id,
      { balance: debt.balanceMinor, interest: 0, months: 0, paidOffOn: null as LocalDate | null },
    ]),
  );
  const alive = () => order.filter((debt) => state.get(debt.id)!.balance > 0);

  let month = 0;
  while (alive().length > 0) {
    if (month >= MAX_PERIODS) throw new RangeError('Plan longer than MAX_PERIODS');
    const date = addMonths(firstPaymentDate, month, anchorDay);
    let available = budget;

    // 1. Interest + minimum payment on every alive debt.
    for (const debt of alive()) {
      const s = state.get(debt.id)!;
      const interest = periodInterest(s.balance, debt.annualRateBps);
      const owed = s.balance + interest;
      const payment = Math.min(debt.minimumPaymentMinor, owed);
      if (payment <= interest && owed > payment) {
        throw new PaymentTooLowError(debt.minimumPaymentMinor, interest);
      }
      s.interest += interest;
      s.balance = owed - payment;
      s.months += 1;
      available -= payment;
      if (s.balance === 0) s.paidOffOn = date;
    }

    // 2. The rest (extra + freed minimums) to the priority debt, then the next one.
    for (const debt of alive()) {
      if (available <= 0) break;
      const s = state.get(debt.id)!;
      const pay = Math.min(available, s.balance);
      s.balance -= pay;
      available -= pay;
      if (s.balance === 0) s.paidOffOn = date;
    }
    month += 1;
  }

  const results = order.map((debt, index): DebtPayoff => {
    const s = state.get(debt.id)!;
    return {
      id: debt.id,
      order: index + 1,
      payoffDate: s.paidOffOn ?? firstPaymentDate,
      months: s.months,
      interestPaidMinor: s.interest,
    };
  });
  const debtFreeDate = results.reduce<LocalDate | null>(
    (latest, debt) => (latest === null || debt.payoffDate > latest ? debt.payoffDate : latest),
    null,
  );

  return {
    strategy,
    extraMonthlyMinor,
    debts: results,
    totalInterestMinor: results.reduce((sum, debt) => sum + debt.interestPaidMinor, 0),
    debtFreeDate: debts.length === 0 ? null : debtFreeDate,
    months: month,
  };
}
