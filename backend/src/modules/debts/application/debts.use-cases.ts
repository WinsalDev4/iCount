import { payoffPlan, type PayoffPlan, type PayoffStrategy } from '@icount/finance';

import type { Clock } from '../../../shared/application/clock.js';
import type { IdGenerator } from '../../../shared/application/id-generator.js';
import type { HouseholdAccess } from '../../households/application/household-access.js';
import { CurrencyMismatchError } from '../../households/domain/households.errors.js';
import type { Today } from '../../../shared/application/today.js';
import type { TransactionRepository } from '../../transactions/domain/transaction-repository.js';
import type { Transaction } from '../../transactions/domain/transaction.js';
import {
  Debt,
  type DebtKind,
  DebtNotFoundError,
  type DebtRepository,
  type EditableDebtFields,
  InvalidDebtPaymentError,
} from '../domain/debt.js';

/** Payments of debts are movements of this built-in category. */
export const LOANS_CATEGORY = 'loans';

async function loadForMember(
  debts: DebtRepository,
  access: HouseholdAccess,
  id: string,
  actorId: string,
): Promise<Debt> {
  const debt = await debts.findById(id);
  if (!debt) throw new DebtNotFoundError(id);
  try {
    await access.requireMember(debt.snapshot.householdId, actorId);
  } catch {
    throw new DebtNotFoundError(id);
  }
  return debt;
}

export class ListDebts {
  constructor(
    private readonly access: HouseholdAccess,
    private readonly debts: DebtRepository,
  ) {}

  async execute(actorId: string, householdId: string): Promise<Debt[]> {
    await this.access.requireMember(householdId, actorId);
    return this.debts.listForHousehold(householdId);
  }
}

export class GetDebt {
  constructor(
    private readonly access: HouseholdAccess,
    private readonly debts: DebtRepository,
  ) {}

  execute(actorId: string, id: string): Promise<Debt> {
    return loadForMember(this.debts, this.access, id, actorId);
  }
}

export class CreateDebt {
  constructor(
    private readonly access: HouseholdAccess,
    private readonly debts: DebtRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(
    actorId: string,
    householdId: string,
    input: {
      name: string;
      kind: DebtKind;
      principalMinor: number;
      currency: string;
      annualRateBps: number;
      aprBps?: number;
      startDate: string;
      termMonths: number;
      monthlyPaymentMinor?: number;
    },
  ): Promise<Debt> {
    const household = await this.access.requireMember(householdId, actorId);
    if (input.currency !== household.currency) {
      throw new CurrencyMismatchError(household.currency, input.currency);
    }
    const debt = Debt.create({
      ...input,
      id: this.ids.next(),
      householdId,
      aprBps: input.aprBps ?? null,
      createdBy: actorId,
      createdAt: this.clock.now(),
    });
    await this.debts.save(debt);
    return debt;
  }
}

export class UpdateDebt {
  constructor(
    private readonly access: HouseholdAccess,
    private readonly debts: DebtRepository,
  ) {}

  async execute(
    actorId: string,
    id: string,
    changes: EditableDebtFields & { currency?: string },
  ): Promise<Debt> {
    const debt = await loadForMember(this.debts, this.access, id, actorId);
    const { currency, ...fields } = changes;
    if (currency !== undefined && currency !== debt.snapshot.currency) {
      throw new CurrencyMismatchError(debt.snapshot.currency, currency);
    }
    debt.edit(fields);
    await this.debts.save(debt);
    return debt;
  }
}

export class DeleteDebt {
  constructor(
    private readonly access: HouseholdAccess,
    private readonly debts: DebtRepository,
  ) {}

  async execute(actorId: string, id: string): Promise<void> {
    await loadForMember(this.debts, this.access, id, actorId);
    await this.debts.delete(id);
  }
}

/** Links an existing "loans" movement of the same household as a payment. */
export class LinkDebtPayment {
  constructor(
    private readonly access: HouseholdAccess,
    private readonly debts: DebtRepository,
    private readonly transactions: TransactionRepository,
  ) {}

  async execute(actorId: string, debtId: string, transactionId: string): Promise<void> {
    const debt = await loadForMember(this.debts, this.access, debtId, actorId);
    const transaction = await this.transactions.findById(transactionId);
    const tx = transaction?.snapshot;
    if (!tx || tx.householdId !== debt.snapshot.householdId) {
      throw new InvalidDebtPaymentError('The movement does not exist in this household.');
    }
    if (tx.type !== 'expense' || tx.categoryId !== LOANS_CATEGORY) {
      throw new InvalidDebtPaymentError('Only expenses of the "Préstamos" category pay debts.');
    }
    await this.debts.linkPayment(debtId, transactionId);
  }
}

export class UnlinkDebtPayment {
  constructor(
    private readonly access: HouseholdAccess,
    private readonly debts: DebtRepository,
  ) {}

  async execute(actorId: string, debtId: string, transactionId: string): Promise<void> {
    await loadForMember(this.debts, this.access, debtId, actorId);
    await this.debts.unlinkPayment(debtId, transactionId);
  }
}

export class ListDebtPayments {
  constructor(
    private readonly access: HouseholdAccess,
    private readonly debts: DebtRepository,
    private readonly transactions: TransactionRepository,
  ) {}

  async execute(actorId: string, debtId: string): Promise<Transaction[]> {
    await loadForMember(this.debts, this.access, debtId, actorId);
    const ids = await this.debts.paymentTransactionIds(debtId);
    const found = await Promise.all(ids.map((id) => this.transactions.findById(id)));
    return found
      .filter((tx): tx is Transaction => tx !== null)
      .sort((a, b) => (a.snapshot.occurredOn < b.snapshot.occurredOn ? 1 : -1));
  }
}

/** Avalanche or snowball over every debt of the household, from next month. */
export class PlanDebtPayoff {
  constructor(
    private readonly access: HouseholdAccess,
    private readonly debts: DebtRepository,
    private readonly today: Today,
  ) {}

  async execute(
    actorId: string,
    householdId: string,
    strategy: PayoffStrategy,
    extraMonthlyMinor: number,
  ): Promise<PayoffPlan & { currency: string }> {
    const household = await this.access.requireMember(householdId, actorId);
    const today = this.today();
    const debts = await this.debts.listForHousehold(householdId);
    const firstOfNextMonth = nextMonthStart(today);
    const plan = payoffPlan(
      debts
        .map((debt) => ({
          id: debt.id,
          balanceMinor: debt.outstandingOn(today),
          annualRateBps: debt.snapshot.annualRateBps,
          minimumPaymentMinor: debt.snapshot.monthlyPaymentMinor,
        }))
        .filter((debt) => debt.balanceMinor > 0),
      strategy,
      extraMonthlyMinor,
      firstOfNextMonth,
    );
    return { ...plan, currency: household.currency };
  }
}

function nextMonthStart(date: string): string {
  const [year, month] = date.split('-').map(Number) as [number, number];
  return month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;
}
