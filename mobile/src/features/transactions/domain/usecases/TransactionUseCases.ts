import type { Page, PageRequest } from '@/core/domain/Page';
import type { YearMonth } from '@/core/domain/YearMonth';

import { startOfDay } from '../calendar';
import type {
  DailyTotal,
  Transaction,
  TransactionChanges,
  TransactionFilters,
} from '../Transaction';
import { TransactionError } from '../TransactionError';
import type { TransactionRepository } from '../TransactionRepository';
import { MAX_DESCRIPTION_LENGTH } from './CreateTransaction';

/** One page of movements, newest first, with the history filters. */
export class ListTransactions {
  constructor(private readonly repository: Pick<TransactionRepository, 'list'>) {}

  execute(
    householdId: string,
    filters: TransactionFilters,
    page: PageRequest = {},
  ): Promise<Page<Transaction>> {
    return this.repository.list(householdId, filters, page);
  }
}

/** One movement for the detail screen; a deleted or foreign id is "not found", never null. */
export class GetTransaction {
  constructor(private readonly repository: Pick<TransactionRepository, 'getById'>) {}

  async execute(id: string): Promise<Transaction> {
    const found = await this.repository.getById(id);
    if (!found) throw new TransactionError('not-found');
    return found;
  }
}

/** Totals per day of a month, for the history heat map. */
export class GetDailyTotals {
  constructor(private readonly repository: Pick<TransactionRepository, 'dailyTotals'>) {}

  execute(householdId: string, period: YearMonth): Promise<readonly DailyTotal[]> {
    return this.repository.dailyTotals(householdId, period);
  }
}

/** Edits a movement with the same rules as creating one. */
export class UpdateTransaction {
  constructor(
    private readonly repository: Pick<TransactionRepository, 'update'>,
    private readonly now: () => Date = () => new Date(),
  ) {}

  execute(id: string, changes: TransactionChanges): Promise<Transaction> {
    if (changes.amount && changes.amount.amountMinor <= 0) {
      return Promise.reject(new TransactionError('invalid', 'amount'));
    }
    const description = changes.description?.trim().replace(/\s+/g, ' ');
    if (description !== undefined && description.length > MAX_DESCRIPTION_LENGTH) {
      return Promise.reject(new TransactionError('invalid', 'description'));
    }
    if (changes.occurredAt && startOfDay(changes.occurredAt) > startOfDay(this.now())) {
      return Promise.reject(new TransactionError('invalid', 'future-date'));
    }
    return this.repository.update(id, {
      ...changes,
      ...(description !== undefined && { description }),
    });
  }
}

export class DeleteTransaction {
  constructor(private readonly repository: Pick<TransactionRepository, 'delete'>) {}

  execute(id: string): Promise<void> {
    return this.repository.delete(id);
  }
}
