import type { UpcomingDue } from './RecurringPayment';
import type { ReminderPlan } from './RemindersScheduler';

/** The reminder arrives at 09:00 of the day before the due date. */
export const REMINDER_HOUR = 9;
/** How far ahead reminders are scheduled; every sync (app open, edit) renews the window. */
export const REMINDER_HORIZON_DAYS = 45;
/** iOS keeps at most 64 pending local notifications for the whole app. */
export const MAX_REMINDERS = 50;

const dayLabel = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/** 09:00 wall-clock of the day before (the Date constructor carries month/year and DST). */
function reminderTime(dueDate: Date): Date {
  return new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate() - 1, REMINDER_HOUR);
}

/**
 * Reminders for the expenses due in the coming days. Incomes need no warning, and a reminder
 * whose time already passed (it is due today, or tomorrow after 09:00) is skipped.
 */
export function planReminders(dues: readonly UpcomingDue[], now: Date): ReminderPlan[] {
  return dues
    .filter((due) => due.type === 'expense')
    .map((due) => ({ due, fireAt: reminderTime(due.dueDate) }))
    .filter(({ fireAt }) => fireAt.getTime() > now.getTime())
    .sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime())
    .slice(0, MAX_REMINDERS)
    .map(({ due, fireAt }) => ({
      id: `${due.recurringPaymentId}:${due.dueDate.getFullYear()}-${due.dueDate.getMonth() + 1}-${due.dueDate.getDate()}`,
      fireAt,
      title: 'Mañana vence un pago',
      body: `${due.name}: ${due.amount.format()} (${dayLabel.format(due.dueDate)})`,
      url: '/recurring',
    }));
}
