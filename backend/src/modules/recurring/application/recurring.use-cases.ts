import { compareLocalDates, occurrencesBetween } from '@icount/finance';

import type { Clock } from '../../../shared/application/clock.js';
import type { IdGenerator } from '../../../shared/application/id-generator.js';
import type { TransactionRunner } from '../../../shared/application/transaction-runner.js';
import {
  acceptsType,
  CategoryTypeMismatchError,
  type CategoryRepository,
  UnknownCategoryError,
} from '../../categories/domain/category.js';
import type { HouseholdAccess } from '../../households/application/household-access.js';
import type { HouseholdRepository } from '../../households/domain/household.js';
import { CurrencyMismatchError } from '../../households/domain/households.errors.js';
import type { TransactionRepository } from '../../transactions/domain/transaction-repository.js';
import { Transaction } from '../../transactions/domain/transaction.js';
import {
  type EditableRecurringFields,
  RecurringPayment,
  type RecurringPaymentProps,
  RecurringPaymentNotFoundError,
  type RecurringPaymentRepository,
} from '../domain/recurring-payment.js';

/** Today as a calendar day in the household's time zone (Spain for now). */
export type Today = () => string;

export function todayIn(clock: Clock, timeZone = 'Europe/Madrid'): Today {
  // en-CA formats dates as YYYY-MM-DD.
  return () => new Intl.DateTimeFormat('en-CA', { timeZone }).format(clock.now());
}

async function assertCategory(
  categories: CategoryRepository,
  householdId: string,
  categoryId: string,
  type: 'income' | 'expense',
): Promise<void> {
  const category = await categories.findAvailable(householdId, categoryId);
  if (!category) throw new UnknownCategoryError(categoryId);
  if (!acceptsType(category, type)) throw new CategoryTypeMismatchError(categoryId, type);
}

async function loadForMember(
  payments: RecurringPaymentRepository,
  access: HouseholdAccess,
  id: string,
  actorId: string,
) {
  const payment = await payments.findById(id);
  if (!payment) throw new RecurringPaymentNotFoundError(id);
  try {
    return {
      payment,
      household: await access.requireMember(payment.snapshot.householdId, actorId),
    };
  } catch {
    throw new RecurringPaymentNotFoundError(id);
  }
}

export type NewRecurringPayment = Omit<
  RecurringPaymentProps,
  | 'id'
  | 'householdId'
  | 'nextDueDate'
  | 'createdBy'
  | 'createdAt'
  | 'payerId'
  | 'debtId'
  | 'endDate'
> & { payerId?: string; debtId?: string; endDate?: string };

export class ListRecurringPayments {
  constructor(
    private readonly access: HouseholdAccess,
    private readonly payments: RecurringPaymentRepository,
  ) {}

  async execute(actorId: string, householdId: string): Promise<RecurringPayment[]> {
    await this.access.requireMember(householdId, actorId);
    return this.payments.listForHousehold(householdId);
  }
}

export class CreateRecurringPayment {
  constructor(
    private readonly access: HouseholdAccess,
    private readonly payments: RecurringPaymentRepository,
    private readonly categories: CategoryRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly today: Today,
  ) {}

  async execute(actorId: string, householdId: string, input: NewRecurringPayment) {
    const household = await this.access.requireMember(householdId, actorId);
    if (input.currency !== household.currency) {
      throw new CurrencyMismatchError(household.currency, input.currency);
    }
    await assertCategory(this.categories, householdId, input.categoryId, input.type);
    const payment = RecurringPayment.create(
      household,
      {
        ...input,
        id: this.ids.next(),
        payerId: input.payerId ?? actorId,
        debtId: input.debtId ?? null,
        endDate: input.endDate ?? null,
        createdBy: actorId,
        createdAt: this.clock.now(),
      },
      this.today(),
    );
    await this.payments.save(payment);
    return payment;
  }
}

export class UpdateRecurringPayment {
  constructor(
    private readonly access: HouseholdAccess,
    private readonly payments: RecurringPaymentRepository,
    private readonly categories: CategoryRepository,
    private readonly today: Today,
  ) {}

  async execute(
    actorId: string,
    id: string,
    changes: EditableRecurringFields & { currency?: string },
  ): Promise<RecurringPayment> {
    const { payment, household } = await loadForMember(this.payments, this.access, id, actorId);
    const { currency, ...fields } = changes;
    if (currency !== undefined && currency !== household.currency) {
      throw new CurrencyMismatchError(household.currency, currency);
    }
    if (fields.categoryId !== undefined) {
      await assertCategory(this.categories, household.id, fields.categoryId, payment.snapshot.type);
    }
    payment.edit(household, fields, this.today());
    await this.payments.save(payment);
    return payment;
  }
}

export class DeleteRecurringPayment {
  constructor(
    private readonly access: HouseholdAccess,
    private readonly payments: RecurringPaymentRepository,
  ) {}

  async execute(actorId: string, id: string): Promise<void> {
    await loadForMember(this.payments, this.access, id, actorId);
    await this.payments.delete(id);
  }
}

export interface UpcomingDue {
  readonly payment: RecurringPayment;
  readonly dueDate: string;
}

/** Future occurrences in a window (calendar view and reminders), earliest first. */
export class ListUpcomingDues {
  constructor(
    private readonly access: HouseholdAccess,
    private readonly payments: RecurringPaymentRepository,
  ) {}

  async execute(
    actorId: string,
    householdId: string,
    from: string,
    to: string,
  ): Promise<UpcomingDue[]> {
    await this.access.requireMember(householdId, actorId);
    const payments = await this.payments.listForHousehold(householdId);
    return payments
      .flatMap((payment) => {
        const { rule, startDate, endDate, nextDueDate } = payment.snapshot;
        if (nextDueDate === null) return [];
        // Never before the next pending one: earlier dates are already movements.
        const windowStart = compareLocalDates(from, nextDueDate) > 0 ? from : nextDueDate;
        return occurrencesBetween(rule, startDate, endDate, windowStart, to).map((dueDate) => ({
          payment,
          dueDate,
        }));
      })
      .sort(
        (a, b) =>
          compareLocalDates(a.dueDate, b.dueDate) || a.payment.id.localeCompare(b.payment.id),
      );
  }
}

/**
 * The daily job: every occurrence due on or before today becomes a movement.
 * Idempotent: each (series, due date) is recorded once in the same database
 * transaction as the movement, so running it twice, or on two servers at once,
 * never duplicates anything. It also catches up on days the job did not run.
 */
export class MaterializeDueRecurringPayments {
  constructor(
    private readonly payments: RecurringPaymentRepository,
    private readonly households: HouseholdRepository,
    private readonly transactions: TransactionRepository,
    private readonly runner: TransactionRunner,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(today: string): Promise<{ created: number }> {
    let created = 0;
    for (const due of await this.payments.findDue(today)) {
      created += await this.runner.run(async () => {
        // Re-read inside the transaction: another run may have advanced it already.
        const payment = await this.payments.findById(due.id);
        const household = payment && (await this.households.findById(payment.snapshot.householdId));
        if (!payment || !household) return 0;

        let count = 0;
        let next = payment.snapshot.nextDueDate;
        while (next !== null && compareLocalDates(next, today) <= 0) {
          const transactionId = this.ids.next();
          if (await this.payments.claimOccurrence(payment.id, next)) {
            const p = payment.snapshot;
            await this.transactions.save(
              Transaction.create(household, {
                id: transactionId,
                type: p.type,
                amountMinor: p.amountMinor,
                currency: p.currency,
                categoryId: p.categoryId,
                description: p.name,
                occurredOn: next,
                payerId: household.isMember(p.payerId) ? p.payerId : p.createdBy,
                shared: p.shared && household.kind === 'shared',
                createdBy: p.createdBy,
                now: this.clock.now(),
              }),
            );
            await this.payments.linkOccurrence(payment.id, next, transactionId);
            count += 1;
          }
          payment.advancePast(next);
          next = payment.snapshot.nextDueDate;
        }
        await this.payments.save(payment);
        return count;
      });
    }
    return { created };
  }
}
