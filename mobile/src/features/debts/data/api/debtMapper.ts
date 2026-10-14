import type {
  AmortizationScheduleDto,
  DebtDto,
  MoneyDto,
  PayoffStrategyResultDto,
} from '@icount/contracts';

import { Money } from '@/core/domain/Money';

import { fromLocalDate, toLocalDate } from '../../../transactions/data/api/transactionMapper';
import type {
  AmortizationSchedule,
  Debt,
  DebtChanges,
  NewDebt,
  PayoffPlan,
} from '../../domain/Debt';

const toMoney = (money: MoneyDto) => Money.ofMinor(money.amountMinor, money.currency);
const fromMoney = (money: Money): MoneyDto => ({
  amountMinor: money.amountMinor,
  currency: money.currency,
});

export function toDebt(dto: DebtDto): Debt {
  return {
    id: dto.id,
    householdId: dto.householdId,
    name: dto.name,
    kind: dto.kind,
    principal: toMoney(dto.principal),
    outstanding: toMoney(dto.outstanding),
    annualRateBps: dto.annualRateBps,
    aprBps: dto.aprBps,
    monthlyPayment: toMoney(dto.monthlyPayment),
    startDate: fromLocalDate(dto.startDate),
    termMonths: dto.termMonths,
    endDate: fromLocalDate(dto.endDate),
  };
}

/** Request body for POST …/debts; the API computes the instalment when it is omitted. */
export function toCreateDebtRequest(input: NewDebt) {
  return {
    name: input.name,
    kind: input.kind,
    principal: fromMoney(input.principal),
    annualRateBps: input.annualRateBps,
    ...(input.aprBps !== undefined ? { aprBps: input.aprBps } : {}),
    startDate: toLocalDate(input.startDate),
    termMonths: input.termMonths,
    ...(input.monthlyPayment ? { monthlyPayment: fromMoney(input.monthlyPayment) } : {}),
  };
}

/** Request body for PATCH: only the fields that change. */
export function toUpdateDebtRequest(changes: DebtChanges) {
  const { monthlyPayment, ...fields } = changes;
  return {
    ...Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)),
    ...(monthlyPayment !== undefined ? { monthlyPayment: fromMoney(monthlyPayment) } : {}),
  };
}

export function toAmortizationSchedule(dto: AmortizationScheduleDto): AmortizationSchedule {
  return {
    debtId: dto.debtId,
    rows: dto.rows.map((row) => ({
      period: row.period,
      date: fromLocalDate(row.date),
      payment: toMoney(row.payment),
      interest: toMoney(row.interest),
      principal: toMoney(row.principal),
      balance: toMoney(row.balance),
    })),
    totalInterest: toMoney(dto.totalInterest),
  };
}

/** `today` is the debt-free date when there is nothing left to pay (the API sends null). */
export function toPayoffPlan(dto: PayoffStrategyResultDto, today: Date): PayoffPlan {
  return {
    strategy: dto.strategy,
    extraMonthly: toMoney(dto.extraMonthly),
    debts: dto.debts.map((debt) => ({
      debtId: debt.debtId,
      order: debt.order,
      payoffDate: fromLocalDate(debt.payoffDate),
      interestPaid: toMoney(debt.interestPaid),
    })),
    totalInterest: toMoney(dto.totalInterest),
    debtFreeDate: dto.debtFreeDate
      ? fromLocalDate(dto.debtFreeDate)
      : new Date(today.getFullYear(), today.getMonth(), today.getDate()),
  };
}
