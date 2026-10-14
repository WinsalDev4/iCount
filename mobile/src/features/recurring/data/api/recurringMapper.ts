import type { MoneyDto, RecurringPaymentDto, UpcomingDueDto } from '@icount/contracts';

import type { CategoryId } from '@/core/domain/Category';
import type { UserId } from '@/core/domain/Ids';
import { Money } from '@/core/domain/Money';

import { fromLocalDate, toLocalDate } from '../../../transactions/data/api/transactionMapper';
import type {
  NewRecurringPayment,
  RecurrenceRule,
  RecurringPayment,
  RecurringPaymentChanges,
  UpcomingDue,
} from '../../domain/RecurringPayment';

const toMoney = (money: MoneyDto) => Money.ofMinor(money.amountMinor, money.currency);
const fromMoney = (money: Money): MoneyDto => ({
  amountMinor: money.amountMinor,
  currency: money.currency,
});

/** Same shape in the contract; copying keeps out any extra field. */
const toRule = (rule: RecurrenceRule): RecurrenceRule => ({
  unit: rule.unit,
  interval: rule.interval,
  dayOfMonth: rule.dayOfMonth,
  ...(rule.monthOfYear !== undefined ? { monthOfYear: rule.monthOfYear } : {}),
});

const toOptionalDate = (value: string | null) => (value === null ? null : fromLocalDate(value));

export function toRecurringPayment(dto: RecurringPaymentDto): RecurringPayment {
  return {
    id: dto.id,
    householdId: dto.householdId,
    name: dto.name,
    kind: dto.kind,
    type: dto.type,
    amount: toMoney(dto.amount),
    categoryId: dto.categoryId as CategoryId,
    rule: toRule(dto.rule),
    startDate: fromLocalDate(dto.startDate),
    endDate: toOptionalDate(dto.endDate),
    nextDueDate: toOptionalDate(dto.nextDueDate),
    payerId: dto.payerId as string as UserId,
    shared: dto.shared,
    debtId: dto.debtId,
  };
}

/** Request body for POST …/recurring. */
export function toCreateRecurringRequest(input: NewRecurringPayment) {
  return {
    name: input.name,
    kind: input.kind,
    type: input.type,
    amount: fromMoney(input.amount),
    categoryId: input.categoryId,
    rule: toRule(input.rule),
    startDate: toLocalDate(input.startDate),
    ...(input.endDate ? { endDate: toLocalDate(input.endDate) } : {}),
    ...(input.payerId ? { payerId: input.payerId } : {}),
    shared: input.shared,
    ...(input.debtId ? { debtId: input.debtId } : {}),
  };
}

/** Request body for PATCH: only the fields that change; `endDate: null` makes it open-ended. */
export function toUpdateRecurringRequest(changes: RecurringPaymentChanges) {
  return {
    ...(changes.name !== undefined ? { name: changes.name } : {}),
    ...(changes.kind !== undefined ? { kind: changes.kind } : {}),
    ...(changes.amount !== undefined ? { amount: fromMoney(changes.amount) } : {}),
    ...(changes.categoryId !== undefined ? { categoryId: changes.categoryId } : {}),
    ...(changes.rule !== undefined ? { rule: toRule(changes.rule) } : {}),
    ...(changes.endDate !== undefined
      ? { endDate: changes.endDate === null ? null : toLocalDate(changes.endDate) }
      : {}),
    ...(changes.payerId !== undefined ? { payerId: changes.payerId } : {}),
    ...(changes.shared !== undefined ? { shared: changes.shared } : {}),
  };
}

export function toUpcomingDue(dto: UpcomingDueDto): UpcomingDue {
  return {
    recurringPaymentId: dto.recurringPaymentId,
    name: dto.name,
    dueDate: fromLocalDate(dto.dueDate),
    type: dto.type,
    amount: toMoney(dto.amount),
    categoryId: dto.categoryId as CategoryId,
  };
}
