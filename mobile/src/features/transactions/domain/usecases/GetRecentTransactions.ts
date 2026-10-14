import type { Transaction } from '../Transaction';
import type { TransactionRepository } from '../TransactionRepository';

/** The latest movements of a household, newest first (the "Últimos movimientos" of Inicio). */
export class GetRecentTransactions {
  constructor(private readonly repository: Pick<TransactionRepository, 'list'>) {}

  async execute(householdId: string, count = 4): Promise<readonly Transaction[]> {
    const page = await this.repository.list(householdId, {}, { limit: count });
    return page.items;
  }
}
