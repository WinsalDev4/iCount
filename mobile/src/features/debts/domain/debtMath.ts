import { addMonths, compareLocalDates, parseLocalDate } from '@icount/finance';

import { Money } from '@/core/domain/Money';
import { fromLocalDate, toLocalDate } from '@/features/transactions/data/api/transactionMapper';

import type { Debt } from './Debt';

type Schedulable = Pick<Debt, 'startDate' | 'termMonths'>;

/**
 * Date of the instalment number `index` (0 = the first one). Instalments keep the day of the
 * first one; in a short month they fall on its last day (the 31st → the 28th in February).
 */
export function installmentDate(debt: Schedulable, index: number): Date {
  const first = toLocalDate(debt.startDate);
  return fromLocalDate(addMonths(first, index, parseLocalDate(first).day));
}

/** The next instalment on or after `today`, or `null` once every instalment has passed. */
export function nextInstallmentDate(debt: Schedulable, today: Date): Date | null {
  const todayKey = toLocalDate(today);
  for (let index = 0; index < debt.termMonths; index++) {
    const date = installmentDate(debt, index);
    if (compareLocalDates(toLocalDate(date), todayKey) >= 0) return date;
  }
  return null;
}

/** How many instalments are left from `today` on (today's counts). */
export function remainingInstallments(debt: Schedulable, today: Date): number {
  const todayKey = toLocalDate(today);
  let remaining = 0;
  for (let index = 0; index < debt.termMonths; index++) {
    if (compareLocalDates(toLocalDate(installmentDate(debt, index)), todayKey) >= 0) remaining += 1;
  }
  return remaining;
}

/** Share of the principal already paid, 0..1 (a bank balance above the principal counts as 0). */
export function paidRatio(debt: Pick<Debt, 'principal' | 'outstanding'>): number {
  const principal = debt.principal.amountMinor;
  if (principal <= 0) return 1;
  const paid = principal - debt.outstanding.amountMinor;
  return Math.min(1, Math.max(0, paid / principal));
}

export interface DebtTotals {
  readonly outstanding: Money;
  readonly monthlyPayments: Money;
  readonly count: number;
}

/** Totals of the debts that are still alive (a paid-off debt adds nothing). */
export function summarizeDebts(debts: readonly Debt[], currency: Money['currency']): DebtTotals {
  const alive = debts.filter((d) => d.outstanding.amountMinor > 0);
  return {
    outstanding: alive.reduce((sum, d) => sum.plus(d.outstanding), Money.zero(currency)),
    monthlyPayments: alive.reduce((sum, d) => sum.plus(d.monthlyPayment), Money.zero(currency)),
    count: alive.length,
  };
}
