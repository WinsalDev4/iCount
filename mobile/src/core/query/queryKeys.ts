import type { YearMonth } from '@/core/domain/YearMonth';

/**
 * Query keys in one place, as hierarchical arrays: invalidating a prefix such as
 * `queryKeys.transactions.all(householdId)` refreshes every list, summary and
 * daily total of that household at once (TanStack matches keys by prefix).
 * Android analogy: the cache keys of a repository; iOS: the identifiers of an NSCache.
 */
export const queryKeys = {
  households: {
    all: () => ['households'] as const,
    mine: () => ['households', 'mine'] as const,
  },
  categories: {
    all: (householdId: string) => ['categories', householdId] as const,
  },
  transactions: {
    all: (householdId: string) => ['transactions', householdId] as const,
    lists: (householdId: string) => ['transactions', householdId, 'list'] as const,
    list: (householdId: string, filters: Readonly<Record<string, unknown>> = {}) =>
      ['transactions', householdId, 'list', filters] as const,
    monthlySummary: (householdId: string, { year, month }: YearMonth) =>
      ['transactions', householdId, 'summary', year, month] as const,
    dailyTotals: (householdId: string, { year, month }: YearMonth) =>
      ['transactions', householdId, 'daily-totals', year, month] as const,
    detail: (id: string) => ['transaction', id] as const,
  },
  budgets: {
    all: (householdId: string) => ['budgets', householdId] as const,
    month: (householdId: string, { year, month }: YearMonth) =>
      ['budgets', householdId, year, month] as const,
  },
  debts: {
    all: (householdId: string) => ['debts', householdId] as const,
    detail: (id: string) => ['debt', id] as const,
  },
  recurring: {
    all: (householdId: string) => ['recurring', householdId] as const,
  },
} as const;
