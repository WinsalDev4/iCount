import type { AmortizationSchedule, Debt, DebtChanges, NewDebt } from '../Debt';
import { DebtError } from '../DebtError';
import type { DebtRepository } from '../DebtRepository';

const MAX_NAME = 60;
const MAX_TERM_MONTHS = 600;

/** Debts of the household, biggest balance first, paid-off ones last. */
export class ListDebts {
  constructor(private readonly repository: Pick<DebtRepository, 'list'>) {}

  async execute(householdId: string): Promise<readonly Debt[]> {
    const debts = await this.repository.list(householdId);
    return [...debts].sort(
      (a, b) =>
        Number(b.outstanding.amountMinor > 0) - Number(a.outstanding.amountMinor > 0) ||
        b.outstanding.amountMinor - a.outstanding.amountMinor,
    );
  }
}

export class GetDebt {
  constructor(private readonly repository: Pick<DebtRepository, 'getById'>) {}

  async execute(id: string): Promise<Debt> {
    const debt = await this.repository.getById(id);
    if (!debt) throw new DebtError('not-found');
    return debt;
  }
}

export class GetAmortizationSchedule {
  constructor(private readonly repository: Pick<DebtRepository, 'schedule'>) {}

  execute(id: string): Promise<AmortizationSchedule> {
    return this.repository.schedule(id);
  }
}

function invalidName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length === 0 || trimmed.length > MAX_NAME;
}

function invalidTerm(months: number): boolean {
  return !Number.isInteger(months) || months < 1 || months > MAX_TERM_MONTHS;
}

function invalidRate(bps: number): boolean {
  return !Number.isInteger(bps) || bps < 0 || bps > 10_000;
}

/** Validates a new debt; a missing instalment is computed by the repository (French method). */
export class CreateDebt {
  constructor(private readonly repository: Pick<DebtRepository, 'create'>) {}

  execute(input: NewDebt): Promise<Debt> {
    if (
      invalidName(input.name) ||
      input.principal.amountMinor <= 0 ||
      invalidTerm(input.termMonths) ||
      invalidRate(input.annualRateBps) ||
      (input.monthlyPayment && input.monthlyPayment.amountMinor <= 0)
    ) {
      return Promise.reject(new DebtError('invalid'));
    }
    return this.repository.create({ ...input, name: input.name.trim().replace(/\s+/g, ' ') });
  }
}

export class UpdateDebt {
  constructor(private readonly repository: Pick<DebtRepository, 'update'>) {}

  execute(id: string, changes: DebtChanges): Promise<Debt> {
    if (
      (changes.name !== undefined && invalidName(changes.name)) ||
      (changes.termMonths !== undefined && invalidTerm(changes.termMonths)) ||
      (changes.annualRateBps !== undefined && invalidRate(changes.annualRateBps)) ||
      (changes.monthlyPayment !== undefined && changes.monthlyPayment.amountMinor <= 0)
    ) {
      return Promise.reject(new DebtError('invalid'));
    }
    return this.repository.update(id, {
      ...changes,
      ...(changes.name !== undefined && { name: changes.name.trim().replace(/\s+/g, ' ') }),
    });
  }
}

export class DeleteDebt {
  constructor(private readonly repository: Pick<DebtRepository, 'delete'>) {}

  execute(id: string): Promise<void> {
    return this.repository.delete(id);
  }
}
