import {
  amortizationSchedule,
  frenchInstallment,
  outstandingBalance,
  PaymentTooLowError,
  type ScheduleInput,
} from '@icount/finance';

import { Money } from '@/core/domain/Money';
import { fromLocalDate, toLocalDate } from '@/features/transactions/data/api/transactionMapper';

import type {
  AmortizationSchedule,
  Debt,
  DebtChanges,
  DebtKind,
  NewDebt,
  PayoffPlan,
  PayoffStrategy,
} from '../domain/Debt';
import { DebtError } from '../domain/DebtError';
import type { DebtRepository } from '../domain/DebtRepository';
import { computePayoffPlan } from '../domain/payoffPlans';

/** What is stored: everything that does NOT depend on today. Balance and end date are derived. */
interface StoredDebt {
  readonly id: string;
  readonly householdId: string;
  readonly name: string;
  readonly kind: DebtKind;
  readonly principal: Money;
  readonly annualRateBps: number;
  readonly aprBps: number | null;
  readonly monthlyPayment: Money;
  readonly startDate: Date;
  readonly termMonths: number;
}

export interface InMemoryDebtOptions {
  readonly debts?: readonly StoredDebt[];
  /** Give each household three sample debts the first time it is listed (default). */
  readonly seedDemoData?: boolean;
  readonly now?: () => Date;
}

/**
 * Development/test adapter (`EXPO_PUBLIC_DATA_SOURCE=memory`). Like the API it computes the
 * balance, the end date and the schedule with the shared engine (@icount/finance); nothing but
 * the loan terms is stored.
 */
export class InMemoryDebtRepository implements DebtRepository {
  private debts: StoredDebt[];
  private sequence = 0;
  private readonly seeded = new Set<string>();
  private readonly seedDemoData: boolean;
  private readonly now: () => Date;

  constructor(options: InMemoryDebtOptions = {}) {
    this.debts = [...(options.debts ?? [])];
    this.seedDemoData = options.seedDemoData ?? options.debts === undefined;
    this.now = options.now ?? (() => new Date());
  }

  async list(householdId: string): Promise<readonly Debt[]> {
    this.ensureSeeded(householdId);
    return this.debts.filter((d) => d.householdId === householdId).map((d) => this.toDebt(d));
  }

  async getById(id: string): Promise<Debt | null> {
    const found = this.debts.find((d) => d.id === id);
    return found ? this.toDebt(found) : null;
  }

  async create(input: NewDebt): Promise<Debt> {
    const monthlyPayment =
      input.monthlyPayment ??
      Money.ofMinor(
        frenchInstallment(input.principal.amountMinor, input.annualRateBps, input.termMonths),
        input.principal.currency,
      );
    this.sequence += 1;
    const stored: StoredDebt = {
      id: `debt-${this.sequence}`,
      householdId: input.householdId,
      name: input.name,
      kind: input.kind,
      principal: input.principal,
      annualRateBps: input.annualRateBps,
      aprBps: input.aprBps ?? null,
      monthlyPayment,
      startDate: startOfDay(input.startDate),
      termMonths: input.termMonths,
    };
    const debt = this.toDebt(stored); // fails here, before storing, if the instalment is too low
    this.debts = [...this.debts, stored];
    return debt;
  }

  async update(id: string, changes: DebtChanges): Promise<Debt> {
    const current = this.require(id);
    const termsChanged = changes.annualRateBps !== undefined || changes.termMonths !== undefined;
    const annualRateBps = changes.annualRateBps ?? current.annualRateBps;
    const termMonths = changes.termMonths ?? current.termMonths;

    // Changing the rate or the term changes the French instalment, unless a new one is given.
    const monthlyPayment =
      changes.monthlyPayment ??
      (termsChanged
        ? Money.ofMinor(
            frenchInstallment(current.principal.amountMinor, annualRateBps, termMonths),
            current.principal.currency,
          )
        : current.monthlyPayment);

    const updated: StoredDebt = {
      ...current,
      name: changes.name ?? current.name,
      kind: changes.kind ?? current.kind,
      annualRateBps,
      aprBps: changes.aprBps === undefined ? current.aprBps : changes.aprBps,
      monthlyPayment,
      termMonths,
    };
    const debt = this.toDebt(updated);
    this.debts = this.debts.map((d) => (d.id === id ? updated : d));
    return debt;
  }

  async delete(id: string): Promise<void> {
    this.require(id);
    this.debts = this.debts.filter((d) => d.id !== id);
  }

  async schedule(id: string): Promise<AmortizationSchedule> {
    const stored = this.require(id);
    const currency = stored.principal.currency;
    const schedule = this.engineSchedule(stored, scheduleInput(stored));
    return {
      debtId: id,
      rows: schedule.rows.map((row) => ({
        period: row.period,
        date: fromLocalDate(row.date),
        payment: Money.ofMinor(row.paymentMinor, currency),
        interest: Money.ofMinor(row.interestMinor, currency),
        principal: Money.ofMinor(row.principalMinor, currency),
        balance: Money.ofMinor(row.balanceMinor, currency),
      })),
      totalInterest: Money.ofMinor(schedule.totalInterestMinor, currency),
    };
  }

  async payoffPlan(
    householdId: string,
    strategy: PayoffStrategy,
    extraMonthly: Money,
  ): Promise<PayoffPlan> {
    const plan = computePayoffPlan(
      await this.list(householdId),
      strategy,
      extraMonthly,
      this.now(),
    );
    if (!plan) {
      return {
        strategy,
        extraMonthly,
        debts: [],
        totalInterest: Money.zero(extraMonthly.currency),
        debtFreeDate: startOfDay(this.now()),
      };
    }
    return plan;
  }

  private toDebt(stored: StoredDebt): Debt {
    const input = scheduleInput(stored);
    const schedule = this.engineSchedule(stored, input);
    const currency = stored.principal.currency;
    const lastPayment = schedule.payoffDate ? fromLocalDate(schedule.payoffDate) : stored.startDate;
    return {
      id: stored.id,
      householdId: stored.householdId,
      name: stored.name,
      kind: stored.kind,
      principal: stored.principal,
      outstanding: Money.ofMinor(outstandingBalance(input, toLocalDate(this.now())), currency),
      annualRateBps: stored.annualRateBps,
      aprBps: stored.aprBps,
      monthlyPayment: stored.monthlyPayment,
      startDate: stored.startDate,
      termMonths: stored.termMonths,
      endDate: lastPayment,
    };
  }

  private engineSchedule(_stored: StoredDebt, input: ScheduleInput) {
    try {
      return amortizationSchedule(input);
    } catch (error) {
      // A payment that does not cover the monthly interest would never end the debt.
      if (error instanceof PaymentTooLowError) throw new DebtError('invalid');
      throw error;
    }
  }

  private require(id: string): StoredDebt {
    const found = this.debts.find((d) => d.id === id);
    if (!found) throw new DebtError('not-found');
    return found;
  }

  private ensureSeeded(householdId: string): void {
    if (!this.seedDemoData || this.seeded.has(householdId)) return;
    this.seeded.add(householdId);
    const today = this.now();
    const monthsAgo = (months: number) =>
      new Date(today.getFullYear(), today.getMonth() - months, Math.min(today.getDate(), 28));
    const make = (
      name: string,
      kind: DebtKind,
      principal: number,
      annualRateBps: number,
      termMonths: number,
      startedMonthsAgo: number,
    ): StoredDebt => {
      this.sequence += 1;
      const principalMoney = Money.ofMinor(principal, 'EUR');
      return {
        id: `debt-${this.sequence}`,
        householdId,
        name,
        kind,
        principal: principalMoney,
        annualRateBps,
        aprBps: null,
        monthlyPayment: Money.ofMinor(
          frenchInstallment(principal, annualRateBps, termMonths),
          'EUR',
        ),
        startDate: monthsAgo(startedMonthsAgo),
        termMonths,
      };
    };
    this.debts = [
      ...this.debts,
      make('Préstamo del coche', 'car', 1_200_000, 690, 60, 24),
      make('Tarjeta de crédito', 'credit-card', 200_000, 2_100, 24, 6),
      make('Préstamo personal', 'personal', 450_000, 590, 36, 8),
    ];
  }
}

function scheduleInput(stored: StoredDebt): ScheduleInput {
  const french = frenchInstallment(
    stored.principal.amountMinor,
    stored.annualRateBps,
    stored.termMonths,
  );
  return {
    principalMinor: stored.principal.amountMinor,
    annualRateBps: stored.annualRateBps,
    paymentMinor: stored.monthlyPayment.amountMinor,
    firstPaymentDate: toLocalDate(stored.startDate),
    // With the contractual instalment the last one absorbs the cent residual, like banks do.
    ...(stored.monthlyPayment.amountMinor === french && { termMonths: stored.termMonths }),
  };
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
