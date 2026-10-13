import type {
  DailyTotalsDto,
  MonthlySummaryDto,
  MoneyDto,
  TransactionDto,
} from '@icount/contracts';

import type { CategoryId } from '@/core/domain/Category';
import type { UserId } from '@/core/domain/Ids';
import { Money } from '@/core/domain/Money';
import type { YearMonth } from '@/core/domain/YearMonth';

import type { MonthlySummary } from '../../domain/MonthlySummary';
import type {
  DailyTotal,
  NewTransaction,
  Transaction,
  TransactionChanges,
} from '../../domain/Transaction';

/** `YYYY-MM-DD` → local midnight (the domain keeps calendar days as local dates). */
export function fromLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number) as [number, number, number];
  return new Date(year, month - 1, day);
}

/** Local calendar day of a Date → `YYYY-MM-DD` (never via toISOString, which is UTC). */
export function toLocalDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function toYearMonthString({ year, month }: YearMonth): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

const toMoney = (money: MoneyDto) => Money.ofMinor(money.amountMinor, money.currency);
const fromMoney = (money: Money): MoneyDto => ({
  amountMinor: money.amountMinor,
  currency: money.currency,
});

export function toTransaction(dto: TransactionDto): Transaction {
  return {
    id: dto.id,
    householdId: dto.householdId,
    type: dto.type,
    amount: toMoney(dto.amount),
    categoryId: dto.categoryId as CategoryId,
    description: dto.description,
    occurredAt: fromLocalDate(dto.occurredOn),
    payerId: dto.payerId as string as UserId,
    shared: dto.shared,
    shares: dto.shares.map((share) => ({
      memberId: share.memberId as string as UserId,
      amount: toMoney(share.amount),
    })),
  };
}

/** Request body for POST …/transactions (validated by the API with the same contract). */
export function toCreateRequest(input: NewTransaction) {
  return {
    ...(input.id ? { id: input.id } : {}),
    type: input.type,
    amount: fromMoney(input.amount),
    categoryId: input.categoryId,
    description: input.description,
    occurredOn: toLocalDate(input.occurredAt),
    ...(input.payerId ? { payerId: input.payerId } : {}),
    shared: input.shared,
  };
}

/** Request body for PATCH: only the fields that change. */
export function toUpdateRequest(changes: TransactionChanges) {
  return {
    ...(changes.type !== undefined ? { type: changes.type } : {}),
    ...(changes.amount !== undefined ? { amount: fromMoney(changes.amount) } : {}),
    ...(changes.categoryId !== undefined ? { categoryId: changes.categoryId } : {}),
    ...(changes.description !== undefined ? { description: changes.description } : {}),
    ...(changes.occurredAt !== undefined ? { occurredOn: toLocalDate(changes.occurredAt) } : {}),
    ...(changes.payerId !== undefined ? { payerId: changes.payerId } : {}),
    ...(changes.shared !== undefined ? { shared: changes.shared } : {}),
  };
}

export function toMonthlySummary(dto: MonthlySummaryDto): MonthlySummary {
  return {
    income: toMoney(dto.income),
    expenses: toMoney(dto.expenses),
    balance: toMoney(dto.balance),
    expensesByCategory: new Map(
      dto.expensesByCategory.map((entry) => [
        entry.categoryId as CategoryId,
        toMoney(entry.amount),
      ]),
    ),
  };
}

export function toDailyTotals(dto: DailyTotalsDto): DailyTotal[] {
  return dto.days.map((day) => ({
    date: fromLocalDate(day.date),
    income: toMoney(day.income),
    expenses: toMoney(day.expenses),
  }));
}
