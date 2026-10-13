import { Money, type CurrencyCode } from '@/core/domain/Money';

import type { MonthlySummary } from '../MonthlySummary';
import type { CategoryId, YearMonth } from '../Transaction';
import type { TransactionRepository } from '../TransactionRepository';

export type { MonthlySummary };

export class GetMonthlySummary {
  constructor(
    private readonly repository: Pick<TransactionRepository, 'findByMonth'>,
    private readonly currency: CurrencyCode,
  ) {}

  async execute(householdId: string, period: YearMonth): Promise<MonthlySummary> {
    const transactions = await this.repository.findByMonth(householdId, period);

    let income = Money.zero(this.currency);
    let expenses = Money.zero(this.currency);
    const expensesByCategory = new Map<CategoryId, Money>();

    for (const tx of transactions) {
      if (tx.type === 'income') {
        income = income.plus(tx.amount);
        continue;
      }
      expenses = expenses.plus(tx.amount);
      const current = expensesByCategory.get(tx.categoryId) ?? Money.zero(this.currency);
      expensesByCategory.set(tx.categoryId, current.plus(tx.amount));
    }

    return { income, expenses, balance: income.minus(expenses), expensesByCategory };
  }
}
