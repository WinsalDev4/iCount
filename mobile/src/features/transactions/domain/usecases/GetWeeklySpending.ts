import { Money, type CurrencyCode } from '@/core/domain/Money';

import { isSameDay, startOfDay, weekDays } from '../calendar';
import type { Transaction } from '../Transaction';
import type { TransactionRepository } from '../TransactionRepository';

export interface DaySpending {
  /** Local midnight of the day. */
  readonly date: Date;
  readonly spent: Money;
  readonly isToday: boolean;
  readonly isFuture: boolean;
}

/** Spending of each day of the current week (Monday to Sunday), for the bars of Inicio. */
export class GetWeeklySpending {
  constructor(
    private readonly repository: Pick<TransactionRepository, 'list'>,
    private readonly currency: CurrencyCode,
  ) {}

  async execute(householdId: string, today: Date): Promise<readonly DaySpending[]> {
    const days = weekDays(today);
    const expenses = await this.expensesBetween(householdId, days[0] as Date, days[6] as Date);
    const startToday = startOfDay(today);

    return days.map((date) => {
      const spent = expenses
        .filter((tx) => isSameDay(tx.occurredAt, date))
        .reduce((sum, tx) => sum.plus(tx.amount), Money.zero(this.currency));
      return {
        date,
        spent,
        isToday: isSameDay(date, startToday),
        isFuture: date > startToday,
      };
    });
  }

  /** Walks the cursor pages: a week can hold more movements than one page. */
  private async expensesBetween(householdId: string, from: Date, to: Date): Promise<Transaction[]> {
    const all: Transaction[] = [];
    let cursor: string | undefined;
    do {
      const page = await this.repository.list(
        householdId,
        { type: 'expense', from, to },
        { cursor, limit: 100 },
      );
      all.push(...page.items);
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    return all;
  }
}
