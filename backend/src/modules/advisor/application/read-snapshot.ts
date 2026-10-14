import type { BudgetRepository } from '../../budgets/domain/budget.js';
import type { CategoryRepository } from '../../categories/domain/category.js';
import type { DebtRepository } from '../../debts/domain/debt.js';
import type { Household } from '../../households/domain/household.js';
import type { RecurringPaymentRepository } from '../../recurring/domain/recurring-payment.js';
import { monthRange } from '../../transactions/application/transactions.use-cases.js';
import type { TransactionRepository } from '../../transactions/domain/transaction-repository.js';
import { type HouseholdSnapshot, monthOf } from '../domain/snapshot.js';

/** Months of spending history the detectors look at (current + 4 before). */
const MONTHS = 5;

/**
 * Builds the aggregate view of a household from the other modules' repositories:
 * totals, not movements (ADR-0020, privacy).
 */
export class ReadHouseholdSnapshot {
  constructor(
    private readonly transactions: TransactionRepository,
    private readonly budgets: BudgetRepository,
    private readonly recurring: RecurringPaymentRepository,
    private readonly debts: DebtRepository,
    private readonly categories: CategoryRepository,
  ) {}

  async execute(household: Household, today: string): Promise<HouseholdSnapshot> {
    const months = Array.from({ length: MONTHS }, (_, i) => monthOf(today, -i));
    const [totals, budgets, recurring, debts, categories] = await Promise.all([
      Promise.all(
        months.map(async (month) => {
          const { from, to } = monthRange(month);
          return { month, totals: await this.transactions.totals(household.id, from, to) };
        }),
      ),
      this.budgets.listForMonth(household.id, monthOf(today)),
      this.recurring.listForHousehold(household.id),
      this.debts.listForHousehold(household.id),
      this.categories.listFor(household.id),
    ]);

    return {
      householdId: household.id,
      currency: household.currency,
      today,
      categoryNames: new Map(categories.map((category) => [category.id, category.name])),
      monthlyExpenses: totals.flatMap(({ month, totals: monthTotals }) =>
        monthTotals.expensesByCategory.map(({ categoryId, amountMinor }) => ({
          month,
          categoryId,
          amountMinor,
        })),
      ),
      budgets: budgets.map((budget) => ({
        id: budget.id,
        categoryId: budget.categoryId,
        month: budget.month,
        limitMinor: budget.limitMinor,
        spentMinor: budget.spentMinor,
      })),
      recurring: recurring
        .map((payment) => payment.snapshot)
        .filter((payment) => payment.nextDueDate !== null)
        .map(({ id, name, kind, type, amountMinor, categoryId, rule }) => ({
          id,
          name,
          kind,
          type,
          amountMinor,
          categoryId,
          rule,
        })),
      debts: debts.map((debt) => ({
        id: debt.id,
        name: debt.snapshot.name,
        outstandingMinor: debt.outstandingOn(today),
        annualRateBps: debt.snapshot.annualRateBps,
        monthlyPaymentMinor: debt.snapshot.monthlyPaymentMinor,
      })),
    };
  }
}
