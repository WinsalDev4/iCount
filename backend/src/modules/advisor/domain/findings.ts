import { roundHalfAwayFromZero, simulateExtraPayment } from '@icount/finance';

import { formatMoney } from '../../../shared/application/format-money.js';
import { type HouseholdSnapshot, monthOf, type RecurringFigures } from './snapshot.js';

export type InsightKind =
  'duplicate-subscription' | 'budget-exceeded' | 'expensive-debt' | 'unusual-spending';

/** Something the app can apply with one tap (ADR-0020), amounts in cents. */
export type AdvisorAction =
  | {
      readonly type: 'set-budget';
      readonly categoryId: string;
      readonly month: string;
      readonly limitMinor: number;
    }
  | {
      readonly type: 'extra-debt-payment';
      readonly debtId: string;
      readonly extraMonthlyMinor: number;
    }
  | { readonly type: 'cancel-recurring'; readonly recurringPaymentId: string };

export interface Evidence {
  readonly label: string;
  readonly amountMinor: number;
}

/**
 * The output of a deterministic detector: every figure here comes from the
 * data. The model may only reorder findings and reword `defaultTitle/Body`
 * using these figures (see figures.ts).
 */
export interface Finding {
  /** Stable while the data does not change, e.g. `budget-exceeded:<budgetId>`. */
  readonly key: string;
  readonly kind: InsightKind;
  /** Higher = more important; the default order when the model is not used. */
  readonly weight: number;
  readonly evidence: readonly Evidence[];
  readonly potentialMonthlySavingsMinor: number | null;
  readonly actions: readonly AdvisorAction[];
  readonly defaultTitle: string;
  readonly defaultBody: string;
  /** Non-money figures the text may mention (counts, rates, months, years). */
  readonly facts: readonly string[];
}

/** Rates above this (TIN) make a debt "expensive": 10 %. */
export const EXPENSIVE_DEBT_RATE_BPS = 1_000;
/** A category is "unusual" from +50 % over its recent average and at least 50 €. */
export const UNUSUAL_RATIO = 1.5;
export const UNUSUAL_MIN_DIFF_MINOR = 5_000;

export function detectAll(snapshot: HouseholdSnapshot): Finding[] {
  return [
    ...duplicateSubscriptions(snapshot),
    ...exceededBudgets(snapshot),
    ...expensiveDebts(snapshot),
    ...unusualSpending(snapshot),
  ].sort((a, b) => b.weight - a.weight || a.key.localeCompare(b.key));
}

/** Monthly cost of a recurring payment: yearly ones count a twelfth. */
export function monthlyCost({ amountMinor, rule }: RecurringFigures): number {
  const months = rule.unit === 'year' ? 12 * rule.interval : rule.interval;
  return roundHalfAwayFromZero(amountMinor / months);
}

/** "Spotify Premium" and "spotify familiar" → "spotify". */
function serviceName(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .match(/[a-z0-9+]{3,}/)?.[0] ?? name.toLowerCase()
  );
}

export function duplicateSubscriptions(snapshot: HouseholdSnapshot): Finding[] {
  const money = (minor: number) => formatMoney(minor, snapshot.currency);
  const groups = new Map<string, RecurringFigures[]>();
  for (const payment of snapshot.recurring) {
    if (payment.kind !== 'subscription' || payment.type !== 'expense') continue;
    const key = serviceName(payment.name);
    groups.set(key, [...(groups.get(key) ?? []), payment]);
  }
  return [...groups.values()]
    .filter((group) => group.length > 1)
    .map((group) => {
      // Keep the most expensive one; the rest are the saving.
      const [keep, ...extra] = [...group].sort(
        (a, b) => monthlyCost(b) - monthlyCost(a) || a.id.localeCompare(b.id),
      ) as [RecurringFigures, ...RecurringFigures[]];
      const savings = extra.reduce((sum, payment) => sum + monthlyCost(payment), 0);
      const names = group.map((payment) => payment.name).join(', ');
      return {
        key: `duplicate-subscription:${group
          .map((p) => p.id)
          .sort()
          .join('+')}`,
        kind: 'duplicate-subscription' as const,
        weight: savings,
        evidence: [
          { label: `Te quedas con «${keep.name}»`, amountMinor: monthlyCost(keep) },
          { label: 'Ahorro al mes', amountMinor: savings },
        ],
        potentialMonthlySavingsMinor: savings,
        actions: extra.slice(0, 3).map((payment) => ({
          type: 'cancel-recurring' as const,
          recurringPaymentId: payment.id,
        })),
        defaultTitle: 'Suscripciones repetidas',
        defaultBody: `Pagas ${group.length} suscripciones parecidas (${names}). Quedándote solo con «${keep.name}» ahorrarías ${money(savings)} al mes.`,
        facts: [String(group.length)],
      };
    });
}

export function exceededBudgets(snapshot: HouseholdSnapshot): Finding[] {
  const money = (minor: number) => formatMoney(minor, snapshot.currency);
  return snapshot.budgets
    .filter((budget) => budget.spentMinor > budget.limitMinor)
    .map((budget) => {
      const over = budget.spentMinor - budget.limitMinor;
      const category = snapshot.categoryNames.get(budget.categoryId) ?? budget.categoryId;
      return {
        key: `budget-exceeded:${budget.id}`,
        kind: 'budget-exceeded' as const,
        weight: over,
        evidence: [
          { label: 'Límite', amountMinor: budget.limitMinor },
          { label: 'Gastado', amountMinor: budget.spentMinor },
          { label: 'Exceso', amountMinor: over },
        ],
        potentialMonthlySavingsMinor: null,
        actions: [],
        defaultTitle: `Presupuesto de ${category} superado`,
        defaultBody: `Llevas ${money(budget.spentMinor)} en ${category} este mes, ${money(over)} por encima del límite de ${money(budget.limitMinor)}.`,
        facts: [],
      };
    });
}

/** A round extra payment: 10 % of the instalment, up to the next 10 €, at least 10 €. */
export function suggestedExtraPayment(monthlyPaymentMinor: number): number {
  return Math.max(1_000, Math.ceil(monthlyPaymentMinor / 10 / 1_000) * 1_000);
}

/** Basis points as Spanish text: 2190 → "21,9 %". */
export function formatRate(bps: number): string {
  return `${(bps / 100).toLocaleString('es-ES', { maximumFractionDigits: 2 })} %`;
}

export function expensiveDebts(snapshot: HouseholdSnapshot): Finding[] {
  const money = (minor: number) => formatMoney(minor, snapshot.currency);
  const firstPayment = `${monthOf(snapshot.today, 1)}-01`;
  return snapshot.debts.flatMap((debt) => {
    if (debt.annualRateBps < EXPENSIVE_DEBT_RATE_BPS || debt.outstandingMinor <= 0) return [];
    const extra = suggestedExtraPayment(debt.monthlyPaymentMinor);
    let simulation;
    try {
      simulation = simulateExtraPayment(
        {
          principalMinor: debt.outstandingMinor,
          annualRateBps: debt.annualRateBps,
          paymentMinor: debt.monthlyPaymentMinor,
          firstPaymentDate: firstPayment,
        },
        extra,
      );
    } catch {
      return []; // An instalment below the interest: the debts screen already warns.
    }
    if (simulation.interestSavedMinor <= 0) return [];
    const rate = formatRate(debt.annualRateBps);
    return [
      {
        key: `expensive-debt:${debt.id}`,
        kind: 'expensive-debt' as const,
        weight: simulation.interestSavedMinor,
        evidence: [
          { label: 'Pendiente', amountMinor: debt.outstandingMinor },
          { label: 'Pago extra al mes', amountMinor: extra },
          { label: 'Intereses que ahorras', amountMinor: simulation.interestSavedMinor },
        ],
        potentialMonthlySavingsMinor: null,
        actions: [
          { type: 'extra-debt-payment' as const, debtId: debt.id, extraMonthlyMinor: extra },
        ],
        defaultTitle: `«${debt.name}» te sale cara`,
        defaultBody: `Al ${rate} de interés, pagando ${money(extra)} más al mes ahorrarías ${money(simulation.interestSavedMinor)} en intereses y terminarías ${simulation.monthsSaved} meses antes.`,
        facts: [rate, String(simulation.monthsSaved)],
      },
    ];
  });
}

/** Last complete month against the average of the three before it. */
export function unusualSpending(snapshot: HouseholdSnapshot): Finding[] {
  const money = (minor: number) => formatMoney(minor, snapshot.currency);
  const last = monthOf(snapshot.today, -1);
  const before = [-2, -3, -4].map((delta) => monthOf(snapshot.today, delta));
  const spent = (month: string, categoryId: string) =>
    snapshot.monthlyExpenses
      .filter((row) => row.month === month && row.categoryId === categoryId)
      .reduce((sum, row) => sum + row.amountMinor, 0);

  const categories = [...new Set(snapshot.monthlyExpenses.map((row) => row.categoryId))];
  return categories.flatMap((categoryId) => {
    const history = before.map((month) => spent(month, categoryId));
    // Needs some history: at least two of the three previous months with spending.
    if (history.filter((amount) => amount > 0).length < 2) return [];
    const average = roundHalfAwayFromZero(history.reduce((a, b) => a + b, 0) / history.length);
    const current = spent(last, categoryId);
    const diff = current - average;
    if (current < average * UNUSUAL_RATIO || diff < UNUSUAL_MIN_DIFF_MINOR) return [];
    const category = snapshot.categoryNames.get(categoryId) ?? categoryId;
    return [
      {
        key: `unusual-spending:${categoryId}:${last}`,
        kind: 'unusual-spending' as const,
        weight: diff,
        evidence: [
          { label: 'Media de los 3 meses anteriores', amountMinor: average },
          { label: 'El mes pasado', amountMinor: current },
          { label: 'Diferencia', amountMinor: diff },
        ],
        potentialMonthlySavingsMinor: diff,
        actions: [
          {
            type: 'set-budget' as const,
            categoryId,
            month: monthOf(snapshot.today),
            limitMinor: average,
          },
        ],
        defaultTitle: `Más gasto de lo normal en ${category}`,
        defaultBody: `El mes pasado gastaste ${money(current)} en ${category}, ${money(diff)} más que tu media de ${money(average)}. Un presupuesto de ${money(average)} te ayudaría a volver a tu nivel.`,
        facts: ['3'],
      },
    ];
  });
}
