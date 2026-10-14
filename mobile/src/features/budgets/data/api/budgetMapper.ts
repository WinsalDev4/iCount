import type { BudgetDto, MoneyDto } from '@icount/contracts';

import type { CategoryId } from '@/core/domain/Category';
import { Money } from '@/core/domain/Money';
import type { YearMonth } from '@/core/domain/YearMonth';

import { toYearMonthString } from '../../../transactions/data/api/transactionMapper';
import type { Budget, NewBudget } from '../../domain/Budget';

const toMoney = (money: MoneyDto) => Money.ofMinor(money.amountMinor, money.currency);
export const fromMoney = (money: Money): MoneyDto => ({
  amountMinor: money.amountMinor,
  currency: money.currency,
});

/** `YYYY-MM` → YearMonth. */
export function fromYearMonthString(value: string): YearMonth {
  const [year, month] = value.split('-').map(Number) as [number, number];
  return { year, month };
}

export function toBudget(dto: BudgetDto): Budget {
  return {
    id: dto.id,
    householdId: dto.householdId,
    categoryId: dto.categoryId as CategoryId,
    month: fromYearMonthString(dto.month),
    limit: toMoney(dto.limit),
    spent: toMoney(dto.spent),
    remaining: toMoney(dto.remaining),
  };
}

/** Request body for POST …/budgets. */
export function toCreateBudgetRequest(input: NewBudget) {
  return {
    categoryId: input.categoryId,
    month: toYearMonthString(input.month),
    limit: fromMoney(input.limit),
  };
}
