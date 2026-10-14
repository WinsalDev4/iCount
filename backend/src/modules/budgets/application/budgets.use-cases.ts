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
import { CurrencyMismatchError } from '../../households/domain/households.errors.js';
import {
  type BudgetRepository,
  type BudgetWithSpending,
  BudgetNotFoundError,
  DuplicateBudgetError,
  InsufficientBudgetError,
  InvalidBudgetMoveError,
} from '../domain/budget.js';

async function loadForMember(
  budgets: BudgetRepository,
  access: HouseholdAccess,
  id: string,
  actorId: string,
): Promise<BudgetWithSpending> {
  const budget = await budgets.findById(id);
  if (!budget) throw new BudgetNotFoundError(id);
  try {
    await access.requireMember(budget.householdId, actorId);
  } catch {
    throw new BudgetNotFoundError(id);
  }
  return budget;
}

export class ListBudgets {
  constructor(
    private readonly access: HouseholdAccess,
    private readonly budgets: BudgetRepository,
  ) {}

  async execute(
    actorId: string,
    householdId: string,
    month: string,
  ): Promise<BudgetWithSpending[]> {
    await this.access.requireMember(householdId, actorId);
    return this.budgets.listForMonth(householdId, month);
  }
}

export class CreateBudget {
  constructor(
    private readonly access: HouseholdAccess,
    private readonly budgets: BudgetRepository,
    private readonly categories: CategoryRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(
    actorId: string,
    householdId: string,
    input: { categoryId: string; month: string; limitMinor: number; currency: string },
  ): Promise<BudgetWithSpending> {
    const household = await this.access.requireMember(householdId, actorId);
    if (input.currency !== household.currency) {
      throw new CurrencyMismatchError(household.currency, input.currency);
    }
    const category = await this.categories.findAvailable(householdId, input.categoryId);
    if (!category) throw new UnknownCategoryError(input.categoryId);
    if (!acceptsType(category, 'expense')) {
      throw new CategoryTypeMismatchError(input.categoryId, 'expense budget');
    }

    const id = this.ids.next();
    const created = await this.budgets.create({
      id,
      householdId,
      categoryId: input.categoryId,
      month: input.month,
      limitMinor: input.limitMinor,
      currency: household.currency,
      createdAt: this.clock.now(),
    });
    if (!created) throw new DuplicateBudgetError(input.categoryId, input.month);
    return (await this.budgets.findById(id))!;
  }
}

export class UpdateBudgetLimit {
  constructor(
    private readonly access: HouseholdAccess,
    private readonly budgets: BudgetRepository,
  ) {}

  async execute(
    actorId: string,
    id: string,
    limit: { amountMinor: number; currency: string },
  ): Promise<BudgetWithSpending> {
    const budget = await loadForMember(this.budgets, this.access, id, actorId);
    if (limit.currency !== budget.currency) {
      throw new CurrencyMismatchError(budget.currency, limit.currency);
    }
    await this.budgets.updateLimit(id, limit.amountMinor);
    return { ...budget, limitMinor: limit.amountMinor };
  }
}

export class DeleteBudget {
  constructor(
    private readonly access: HouseholdAccess,
    private readonly budgets: BudgetRepository,
  ) {}

  async execute(actorId: string, id: string): Promise<void> {
    await loadForMember(this.budgets, this.access, id, actorId);
    await this.budgets.delete(id);
  }
}

/** "Move 50 € from Ocio to Comida": the month's total limit stays the same. */
export class MoveBudgetAmount {
  constructor(
    private readonly access: HouseholdAccess,
    private readonly budgets: BudgetRepository,
    private readonly runner: TransactionRunner,
  ) {}

  execute(
    actorId: string,
    householdId: string,
    move: { fromId: string; toId: string; amountMinor: number; currency: string },
  ): Promise<[BudgetWithSpending, BudgetWithSpending]> {
    return this.runner.run(async () => {
      await this.access.requireMember(householdId, actorId);
      const from = await loadForMember(this.budgets, this.access, move.fromId, actorId);
      const to = await loadForMember(this.budgets, this.access, move.toId, actorId);
      if (from.householdId !== householdId || to.householdId !== householdId) {
        throw new InvalidBudgetMoveError('Both budgets must belong to this household.');
      }
      if (from.month !== to.month) {
        throw new InvalidBudgetMoveError('Both budgets must be of the same month.');
      }
      if (move.currency !== from.currency) {
        throw new CurrencyMismatchError(from.currency, move.currency);
      }
      if (from.limitMinor - move.amountMinor < 1) throw new InsufficientBudgetError();

      await this.budgets.updateLimit(from.id, from.limitMinor - move.amountMinor);
      await this.budgets.updateLimit(to.id, to.limitMinor + move.amountMinor);
      return [
        { ...from, limitMinor: from.limitMinor - move.amountMinor },
        { ...to, limitMinor: to.limitMinor + move.amountMinor },
      ];
    });
  }
}
