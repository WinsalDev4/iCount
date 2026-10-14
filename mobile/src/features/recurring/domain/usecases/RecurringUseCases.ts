import { addDays, startOfDay } from '@/features/transactions/domain/calendar';

import { RecurringError } from '../RecurringError';
import type {
  NewRecurringPayment,
  RecurrenceRule,
  RecurringPayment,
  RecurringPaymentChanges,
  UpcomingDue,
} from '../RecurringPayment';
import type { RecurringPaymentRepository } from '../RecurringPaymentRepository';
import { planReminders, REMINDER_HORIZON_DAYS } from '../reminderPlans';
import type { RemindersScheduler } from '../RemindersScheduler';

const MAX_NAME = 60;

function invalidName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length === 0 || trimmed.length > MAX_NAME;
}

/** Mirrors `recurrenceRuleSchema`: yearly rules need a month, monthly ones must not have one. */
function invalidRule(rule: RecurrenceRule): boolean {
  return (
    !Number.isInteger(rule.interval) ||
    rule.interval < 1 ||
    rule.interval > 24 ||
    !Number.isInteger(rule.dayOfMonth) ||
    rule.dayOfMonth < 1 ||
    rule.dayOfMonth > 31 ||
    (rule.unit === 'year') !== (rule.monthOfYear !== undefined) ||
    (rule.monthOfYear !== undefined && (rule.monthOfYear < 1 || rule.monthOfYear > 12))
  );
}

const cleanName = (name: string) => name.trim().replace(/\s+/g, ' ');

/** Recurring payments, the soonest due first; the ended ones (no next date) go last. */
export class ListRecurringPayments {
  constructor(private readonly repository: Pick<RecurringPaymentRepository, 'list'>) {}

  async execute(householdId: string): Promise<readonly RecurringPayment[]> {
    const payments = await this.repository.list(householdId);
    return [...payments].sort((a, b) => {
      if (a.nextDueDate === null || b.nextDueDate === null) {
        return Number(a.nextDueDate === null) - Number(b.nextDueDate === null);
      }
      return a.nextDueDate.getTime() - b.nextDueDate.getTime() || a.name.localeCompare(b.name);
    });
  }
}

export class CreateRecurringPayment {
  constructor(private readonly repository: Pick<RecurringPaymentRepository, 'create'>) {}

  execute(input: NewRecurringPayment): Promise<RecurringPayment> {
    if (
      invalidName(input.name) ||
      input.amount.amountMinor <= 0 ||
      invalidRule(input.rule) ||
      (input.endDate && startOfDay(input.endDate) < startOfDay(input.startDate))
    ) {
      return Promise.reject(new RecurringError('invalid'));
    }
    return this.repository.create({ ...input, name: cleanName(input.name) });
  }
}

export class UpdateRecurringPayment {
  constructor(private readonly repository: Pick<RecurringPaymentRepository, 'update'>) {}

  execute(id: string, changes: RecurringPaymentChanges): Promise<RecurringPayment> {
    if (
      (changes.name !== undefined && invalidName(changes.name)) ||
      (changes.amount !== undefined && changes.amount.amountMinor <= 0) ||
      (changes.rule !== undefined && invalidRule(changes.rule))
    ) {
      return Promise.reject(new RecurringError('invalid'));
    }
    return this.repository.update(id, {
      ...changes,
      ...(changes.name !== undefined && { name: cleanName(changes.name) }),
    });
  }
}

export class DeleteRecurringPayment {
  constructor(private readonly repository: Pick<RecurringPaymentRepository, 'delete'>) {}

  execute(id: string): Promise<void> {
    return this.repository.delete(id);
  }
}

/** The occurrences due between two days (both inclusive), earliest first. */
export class ListUpcomingDues {
  constructor(private readonly repository: Pick<RecurringPaymentRepository, 'upcoming'>) {}

  execute(householdId: string, from: Date, to: Date): Promise<readonly UpcomingDue[]> {
    if (startOfDay(from) > startOfDay(to)) return Promise.reject(new RecurringError('invalid'));
    return this.repository.upcoming(householdId, startOfDay(from), startOfDay(to));
  }
}

/**
 * Makes the local reminders match what is due in the next weeks. Idempotent: call it after every
 * change and whenever the screen opens, so the 45-day window keeps moving forward.
 */
export class SyncReminders {
  constructor(
    private readonly repository: Pick<RecurringPaymentRepository, 'upcoming'>,
    private readonly scheduler: Pick<RemindersScheduler, 'replaceAll'>,
  ) {}

  async execute(householdId: string, now: Date = new Date()): Promise<number> {
    const today = startOfDay(now);
    const dues = await this.repository.upcoming(
      householdId,
      today,
      addDays(today, REMINDER_HORIZON_DAYS),
    );
    const plans = planReminders(dues, now);
    await this.scheduler.replaceAll(plans);
    return plans.length;
  }
}
