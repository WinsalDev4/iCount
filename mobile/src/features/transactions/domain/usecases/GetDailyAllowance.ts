import { Money, type CurrencyCode } from '@/core/domain/Money';

import { isSameDay } from '../calendar';
import { computeDailyAllowance, type DailyAllowance } from '../dailyAllowance';
import { summarizeTransactions } from '../summarize';
import type { TransactionRepository } from '../TransactionRepository';

/** How much can be spent today (and what is left of it). Rules: `computeDailyAllowance`. */
export class GetDailyAllowance {
  constructor(
    private readonly repository: Pick<TransactionRepository, 'findByMonth'>,
    private readonly currency: CurrencyCode,
  ) {}

  async execute(householdId: string, today: Date): Promise<DailyAllowance> {
    const month = { year: today.getFullYear(), month: today.getMonth() + 1 };
    const transactions = await this.repository.findByMonth(householdId, month);

    // Movements dated after today (already entered, e.g. a future rent) do not count yet.
    const sofar = transactions.filter((tx) => tx.occurredAt <= endOfDay(today));
    const summary = summarizeTransactions(sofar, this.currency);

    const spentToday = sofar
      .filter((tx) => tx.type === 'expense' && isSameDay(tx.occurredAt, today))
      .reduce((sum, tx) => sum.plus(tx.amount), Money.zero(this.currency));

    return computeDailyAllowance({ monthBalance: summary.balance, spentToday, today });
  }
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}
