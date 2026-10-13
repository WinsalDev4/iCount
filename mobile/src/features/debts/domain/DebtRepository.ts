import type { Money } from '@/core/domain/Money';

import type {
  AmortizationSchedule,
  Debt,
  DebtChanges,
  NewDebt,
  PayoffPlan,
  PayoffStrategy,
} from './Debt';

/**
 * Port for debts. Implementations: InMemoryDebtRepository (B-4.2) and
 * ApiDebtRepository (A-4.3). Simulations that must work offline (extra payment
 * chips) use @icount/finance directly in use cases instead of this port.
 * Failures reject with `DebtError`.
 */
export interface DebtRepository {
  list(householdId: string): Promise<readonly Debt[]>;
  getById(id: string): Promise<Debt | null>;
  create(input: NewDebt): Promise<Debt>;
  update(id: string, changes: DebtChanges): Promise<Debt>;
  delete(id: string): Promise<void>;
  schedule(id: string): Promise<AmortizationSchedule>;
  payoffPlan(
    householdId: string,
    strategy: PayoffStrategy,
    extraMonthly: Money,
  ): Promise<PayoffPlan>;
}
