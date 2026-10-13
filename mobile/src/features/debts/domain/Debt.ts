import type { Money } from '@/core/domain/Money';

export type DebtKind = 'car' | 'mortgage' | 'personal' | 'credit-card' | 'other';

export interface Debt {
  readonly id: string;
  readonly householdId: string;
  readonly name: string;
  readonly kind: DebtKind;
  /** Amount originally borrowed. */
  readonly principal: Money;
  /** Balance still owed today. */
  readonly outstanding: Money;
  /** Nominal annual rate (TIN) in basis points: 6,90 % → 690. */
  readonly annualRateBps: number;
  /** APR (TAE) as printed by the bank, informative only. */
  readonly aprBps: number | null;
  readonly monthlyPayment: Money;
  /** First instalment (local midnight). */
  readonly startDate: Date;
  readonly termMonths: number;
  /** Last instalment at the current pace. */
  readonly endDate: Date;
}

export interface NewDebt {
  readonly householdId: string;
  readonly name: string;
  readonly kind: DebtKind;
  readonly principal: Money;
  readonly annualRateBps: number;
  readonly aprBps?: number;
  readonly startDate: Date;
  readonly termMonths: number;
  /** When omitted, the French instalment is computed. */
  readonly monthlyPayment?: Money;
}

export type DebtChanges = Partial<
  Pick<Debt, 'name' | 'kind' | 'annualRateBps' | 'aprBps' | 'monthlyPayment' | 'termMonths'>
>;

export interface AmortizationRow {
  readonly period: number;
  readonly date: Date;
  readonly payment: Money;
  readonly interest: Money;
  readonly principal: Money;
  /** Balance after this payment. */
  readonly balance: Money;
}

export interface AmortizationSchedule {
  readonly debtId: string;
  readonly rows: readonly AmortizationRow[];
  readonly totalInterest: Money;
}

/** Avalanche: highest rate first. Snowball: smallest balance first. */
export type PayoffStrategy = 'avalanche' | 'snowball';

export interface PayoffPlanItem {
  readonly debtId: string;
  readonly order: number;
  readonly payoffDate: Date;
  readonly interestPaid: Money;
}

export interface PayoffPlan {
  readonly strategy: PayoffStrategy;
  readonly extraMonthly: Money;
  readonly debts: readonly PayoffPlanItem[];
  readonly totalInterest: Money;
  readonly debtFreeDate: Date;
}
