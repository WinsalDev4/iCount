import type { CategoryId } from '@/core/domain/Category';
import { Money } from '@/core/domain/Money';
import { currentMemoryIdentity } from '@/features/auth/data/memoryIdentity';
import { startOfDay } from '@/features/transactions/domain/calendar';

import { RecurringError } from '../domain/RecurringError';
import type {
  NewRecurringPayment,
  RecurringKind,
  RecurringPayment,
  RecurringPaymentChanges,
  UpcomingDue,
} from '../domain/RecurringPayment';
import type { RecurringPaymentRepository } from '../domain/RecurringPaymentRepository';
import { dueDatesBetween, nextDueDate } from '../domain/recurrenceMath';

/** What is stored: everything but the next due date, which depends on today. */
type StoredRecurring = Omit<RecurringPayment, 'nextDueDate'>;

export interface InMemoryRecurringOptions {
  readonly payments?: readonly StoredRecurring[];
  /** Give each household a few sample payments the first time it is listed (default). */
  readonly seedDemoData?: boolean;
  readonly now?: () => Date;
}

/**
 * Development/test adapter (`EXPO_PUBLIC_DATA_SOURCE=memory`). Due dates come from the shared
 * recurrence engine (@icount/finance), so they match what the API's job will generate. This
 * adapter only lists and forecasts: turning a due date into a movement is the server job's work
 * (A-4.3), so nothing is posted to the transaction store here.
 */
export class InMemoryRecurringRepository implements RecurringPaymentRepository {
  private payments: StoredRecurring[];
  private sequence = 0;
  private readonly seeded = new Set<string>();
  private readonly seedDemoData: boolean;
  private readonly now: () => Date;

  constructor(options: InMemoryRecurringOptions = {}) {
    this.payments = [...(options.payments ?? [])];
    this.seedDemoData = options.seedDemoData ?? options.payments === undefined;
    this.now = options.now ?? (() => new Date());
  }

  async list(householdId: string): Promise<readonly RecurringPayment[]> {
    this.ensureSeeded(householdId);
    return this.payments.filter((p) => p.householdId === householdId).map((p) => this.expose(p));
  }

  async create(input: NewRecurringPayment): Promise<RecurringPayment> {
    this.sequence += 1;
    const stored: StoredRecurring = {
      id: `recurring-${this.sequence}`,
      householdId: input.householdId,
      name: input.name,
      kind: input.kind,
      type: input.type,
      amount: input.amount,
      categoryId: input.categoryId,
      rule: input.rule,
      startDate: startOfDay(input.startDate),
      endDate: input.endDate ? startOfDay(input.endDate) : null,
      payerId: input.payerId ?? currentMemoryIdentity().userId,
      shared: input.shared,
      debtId: input.debtId ?? null,
    };
    this.payments = [...this.payments, stored];
    return this.expose(stored);
  }

  async update(id: string, changes: RecurringPaymentChanges): Promise<RecurringPayment> {
    const current = this.require(id);
    const updated: StoredRecurring = {
      ...current,
      ...(changes.name !== undefined && { name: changes.name }),
      ...(changes.kind !== undefined && { kind: changes.kind }),
      ...(changes.amount !== undefined && { amount: changes.amount }),
      ...(changes.categoryId !== undefined && { categoryId: changes.categoryId }),
      ...(changes.rule !== undefined && { rule: changes.rule }),
      ...(changes.endDate !== undefined && {
        endDate: changes.endDate ? startOfDay(changes.endDate) : null,
      }),
      ...(changes.payerId !== undefined && { payerId: changes.payerId }),
      ...(changes.shared !== undefined && { shared: changes.shared }),
    };
    this.payments = this.payments.map((p) => (p.id === id ? updated : p));
    return this.expose(updated);
  }

  async delete(id: string): Promise<void> {
    this.require(id);
    this.payments = this.payments.filter((p) => p.id !== id);
  }

  async upcoming(householdId: string, from: Date, to: Date): Promise<readonly UpcomingDue[]> {
    this.ensureSeeded(householdId);
    return this.payments
      .filter((p) => p.householdId === householdId)
      .flatMap((p) =>
        dueDatesBetween(p, from, to).map((dueDate) => ({
          recurringPaymentId: p.id,
          name: p.name,
          dueDate,
          type: p.type,
          amount: p.amount,
          categoryId: p.categoryId,
        })),
      )
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime() || a.name.localeCompare(b.name));
  }

  private expose(stored: StoredRecurring): RecurringPayment {
    return { ...stored, nextDueDate: nextDueDate(stored, this.now()) };
  }

  private require(id: string): StoredRecurring {
    const found = this.payments.find((p) => p.id === id);
    if (!found) throw new RecurringError('not-found');
    return found;
  }

  private ensureSeeded(householdId: string): void {
    if (!this.seedDemoData || this.seeded.has(householdId)) return;
    this.seeded.add(householdId);
    const today = this.now();
    const payerId = currentMemoryIdentity().userId;
    const monthsAgo = (months: number, day: number) =>
      new Date(today.getFullYear(), today.getMonth() - months, day);

    const make = (
      name: string,
      kind: RecurringKind,
      amountMinor: number,
      categoryId: string,
      rule: StoredRecurring['rule'],
      startDate: Date,
      type: 'income' | 'expense' = 'expense',
      shared = false,
    ): StoredRecurring => {
      this.sequence += 1;
      return {
        id: `recurring-${this.sequence}`,
        householdId,
        name,
        kind,
        type,
        amount: Money.ofMinor(amountMinor, 'EUR'),
        categoryId: categoryId as CategoryId,
        rule,
        startDate,
        endDate: null,
        payerId,
        shared,
        debtId: null,
      };
    };

    this.payments = [
      ...this.payments,
      make('Alquiler', 'bill', 75_000, 'housing', month(1), monthsAgo(8, 1), 'expense', true),
      make('Internet y móvil', 'bill', 4_990, 'bills', month(5), monthsAgo(6, 5), 'expense', true),
      make('Netflix', 'subscription', 1_299, 'leisure', month(17), monthsAgo(10, 17)),
      make('Seguro del coche', 'bill', 48_000, 'insurance', year(20, 3), monthsAgo(20, 20)),
      make('Nómina', 'income', 195_000, 'salary', month(28), monthsAgo(12, 28), 'income'),
    ];
  }
}

const month = (dayOfMonth: number, interval = 1): StoredRecurring['rule'] => ({
  unit: 'month',
  interval,
  dayOfMonth,
});
const year = (dayOfMonth: number, monthOfYear: number): StoredRecurring['rule'] => ({
  unit: 'year',
  interval: 1,
  dayOfMonth,
  monthOfYear,
});
