import type { CurrencyCode } from '@/core/domain/Money';

import type { MonthlySummary } from '../MonthlySummary';
import { summarizeTransactions } from '../summarize';
import type { YearMonth } from '../Transaction';
import type { TransactionRepository } from '../TransactionRepository';

export type { MonthlySummary };

export class GetMonthlySummary {
  constructor(
    private readonly repository: Pick<TransactionRepository, 'findByMonth'>,
    private readonly currency: CurrencyCode,
  ) {}

  async execute(householdId: string, period: YearMonth): Promise<MonthlySummary> {
    const transactions = await this.repository.findByMonth(householdId, period);
    return summarizeTransactions(transactions, this.currency);
  }
}
