import { currentMemoryIdentity } from '@/features/auth/data/memoryIdentity';

import type { UserId } from '@/core/domain/Ids';
import { Money, type CurrencyCode } from '@/core/domain/Money';
import type { Page, PageRequest } from '@/core/domain/Page';

import type { MonthlySummary } from '../domain/MonthlySummary';
import { summarizeTransactions, totalsByDay } from '../domain/summarize';
import type {
  CategoryId,
  DailyTotal,
  NewTransaction,
  Transaction,
  TransactionChanges,
  TransactionFilters,
  TransactionType,
  YearMonth,
} from '../domain/Transaction';
import { TransactionError } from '../domain/TransactionError';
import type { TransactionRepository } from '../domain/TransactionRepository';

export interface InMemoryTransactionOptions {
  /** Starting data. Giving it turns the demo data off unless `seedDemoData` says otherwise. */
  readonly transactions?: readonly Transaction[];
  /** Fill each household with sample movements the first time it is asked for (default). */
  readonly seedDemoData?: boolean;
  readonly now?: () => Date;
  readonly newId?: () => string;
  /** Who the signed-in member is; defaults to the in-memory identity (see auth/memoryIdentity). */
  readonly me?: () => UserId;
  readonly currency?: CurrencyCode;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/**
 * Development/test adapter (`EXPO_PUBLIC_DATA_SOURCE=memory`): everything lives in the device and
 * is lost on restart. It implements the whole port with the same rules as the API (filters,
 * newest-first cursor pages, summaries), so the screens behave the same in both modes.
 *
 * Shared movements get no `shares` here: the real split is computed by the server from the
 * household's rule.
 */
export class InMemoryTransactionRepository implements TransactionRepository {
  private transactions: Transaction[];
  private readonly seeded = new Set<string>();
  private readonly seedDemoData: boolean;
  private readonly now: () => Date;
  private readonly newId: () => string;
  private readonly me: () => UserId;
  private readonly currency: CurrencyCode;
  private counter = 0;

  constructor(options: InMemoryTransactionOptions = {}) {
    this.transactions = [...(options.transactions ?? [])];
    this.seedDemoData = options.seedDemoData ?? options.transactions === undefined;
    this.now = options.now ?? (() => new Date());
    this.newId = options.newId ?? (() => `memory-${++this.counter}`);
    this.me = options.me ?? (() => currentMemoryIdentity().userId);
    this.currency = options.currency ?? 'EUR';
  }

  async findByMonth(householdId: string, { year, month }: YearMonth): Promise<Transaction[]> {
    this.ensureSeeded(householdId);
    return this.transactions.filter(
      (tx) =>
        tx.householdId === householdId &&
        tx.occurredAt.getFullYear() === year &&
        tx.occurredAt.getMonth() + 1 === month,
    );
  }

  async list(
    householdId: string,
    filters: TransactionFilters,
    page: PageRequest = {},
  ): Promise<Page<Transaction>> {
    this.ensureSeeded(householdId);
    const matching = this.transactions
      .filter((tx) => tx.householdId === householdId && matches(tx, filters))
      .sort(newestFirst);

    const limit = Math.min(Math.max(page.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
    const offset = parseCursor(page.cursor);
    const items = matching.slice(offset, offset + limit);
    const next = offset + limit;
    return { items, nextCursor: next < matching.length ? String(next) : null };
  }

  async getById(id: string): Promise<Transaction | null> {
    return this.transactions.find((tx) => tx.id === id) ?? null;
  }

  async create(input: NewTransaction): Promise<Transaction> {
    if (input.amount.amountMinor <= 0) throw new TransactionError('invalid');
    // Retrying with the same client-generated id must not duplicate the movement.
    const existing = input.id ? await this.getById(input.id) : null;
    if (existing) return existing;

    const created: Transaction = {
      id: input.id ?? this.newId(),
      type: input.type,
      amount: input.amount,
      categoryId: input.categoryId,
      description: input.description,
      occurredAt: startOfDay(input.occurredAt),
      householdId: input.householdId,
      payerId: input.payerId ?? this.me(),
      shared: input.shared,
      shares: [],
    };
    this.transactions = [created, ...this.transactions];
    return created;
  }

  async update(id: string, changes: TransactionChanges): Promise<Transaction> {
    const current = await this.getById(id);
    if (!current) throw new TransactionError('not-found');
    if (changes.amount && changes.amount.amountMinor <= 0) throw new TransactionError('invalid');

    const updated: Transaction = {
      ...current,
      ...definedOnly(changes),
      occurredAt: changes.occurredAt ? startOfDay(changes.occurredAt) : current.occurredAt,
      shares: [],
    };
    this.transactions = this.transactions.map((tx) => (tx.id === id ? updated : tx));
    return updated;
  }

  async delete(id: string): Promise<void> {
    if (!(await this.getById(id))) throw new TransactionError('not-found');
    this.transactions = this.transactions.filter((tx) => tx.id !== id);
  }

  async monthlySummary(householdId: string, period: YearMonth): Promise<MonthlySummary> {
    return summarizeTransactions(await this.findByMonth(householdId, period), this.currency);
  }

  async dailyTotals(householdId: string, period: YearMonth): Promise<readonly DailyTotal[]> {
    return totalsByDay(await this.findByMonth(householdId, period), this.currency);
  }

  private ensureSeeded(householdId: string): void {
    if (!this.seedDemoData || this.seeded.has(householdId)) return;
    this.seeded.add(householdId);
    this.transactions = [...demoData(householdId, this.now(), this.me()), ...this.transactions];
  }
}

function matches(tx: Transaction, filters: TransactionFilters): boolean {
  if (filters.type && tx.type !== filters.type) return false;
  if (filters.categoryId && tx.categoryId !== filters.categoryId) return false;
  if (filters.shared !== undefined && tx.shared !== filters.shared) return false;
  if (
    filters.memberId &&
    tx.payerId !== filters.memberId &&
    !tx.shares.some((share) => share.memberId === filters.memberId)
  ) {
    return false;
  }
  if (filters.from && tx.occurredAt < startOfDay(filters.from)) return false;
  if (filters.to && tx.occurredAt > startOfDay(filters.to)) return false;
  if (filters.query?.trim() && !fold(tx.description).includes(fold(filters.query.trim()))) {
    return false;
  }
  return true;
}

/** Case and accent insensitive, so "cafe" finds "Café". */
function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function newestFirst(a: Transaction, b: Transaction): number {
  return b.occurredAt.getTime() - a.occurredAt.getTime() || b.id.localeCompare(a.id);
}

function parseCursor(cursor: string | undefined): number {
  const offset = Number(cursor ?? 0);
  return Number.isInteger(offset) && offset >= 0 ? offset : 0;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** `{ ...changes }` would copy `undefined` values over real ones. */
function definedOnly<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;
}

function demoData(householdId: string, now: Date, me: UserId): Transaction[] {
  const make = (
    n: number,
    monthOffset: number,
    day: number,
    type: TransactionType,
    amountMinor: number,
    categoryId: CategoryId,
    description: string,
    shared = false,
  ): Transaction => {
    // Never in the future: a day later than today (this month) is pulled back to today.
    const lastDay = monthOffset === 0 ? now.getDate() : 28;
    return {
      id: `${householdId}-demo-${monthOffset === 0 ? 'm' : 'p'}${n}`,
      type,
      amount: Money.ofMinor(amountMinor, 'EUR'),
      categoryId,
      description,
      occurredAt: new Date(now.getFullYear(), now.getMonth() - monthOffset, Math.min(day, lastDay)),
      householdId,
      payerId: me,
      shared,
      shares: [],
    };
  };

  return [
    make(1, 0, 1, 'income', 245_000, 'salary', 'Nómina'),
    make(2, 0, 2, 'expense', 85_000, 'housing', 'Alquiler', true),
    make(3, 0, 4, 'expense', 9_435, 'food', 'Supermercado', true),
    make(4, 0, 5, 'expense', 32_000, 'loans', 'Letra del coche'),
    make(5, 0, 6, 'expense', 6_890, 'bills', 'Luz', true),
    make(6, 0, 8, 'expense', 4_500, 'insurance', 'Seguro hogar'),
    make(7, 0, 10, 'expense', 3_250, 'leisure', 'Cine y cena'),
    make(8, 0, 12, 'expense', 4_120, 'food', 'Compra semanal', true),
    make(9, 0, 14, 'expense', 1_850, 'transport', 'Gasolina'),
    make(10, 0, 18, 'expense', 2_400, 'leisure', 'Concierto'),
    make(1, 1, 1, 'income', 245_000, 'salary', 'Nómina'),
    make(2, 1, 2, 'expense', 85_000, 'housing', 'Alquiler', true),
    make(3, 1, 9, 'expense', 11_220, 'food', 'Supermercado', true),
    make(4, 1, 15, 'expense', 5_600, 'bills', 'Internet y móvil', true),
  ];
}
