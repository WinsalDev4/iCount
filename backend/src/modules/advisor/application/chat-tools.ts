import { simulateExtraPayment } from '@icount/finance';
import { z } from 'zod';

import { formatMoney } from '../../../shared/application/format-money.js';
import type { AdvisorTool, Plan } from '../domain/advisor.js';
import { detectAll, formatRate } from '../domain/findings.js';
import { type HouseholdSnapshot, monthOf } from '../domain/snapshot.js';

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const MAX_EXTRA_MINOR = 1_000_000; // 10.000 € a month is not a realistic simulation

function tool<Input>(definition: AdvisorTool<Input>): AdvisorTool {
  return definition as AdvisorTool;
}

/**
 * The tools of the chat (ADR-0020): read-only aggregates of the household and
 * simulations with @icount/finance. Every figure in a result is pre-formatted,
 * so the model copies it instead of computing it.
 */
export function chatTools(snapshot: HouseholdSnapshot, newId: () => string): AdvisorTool[] {
  const money = (minor: number) => formatMoney(minor, snapshot.currency);
  const category = (id: string) => snapshot.categoryNames.get(id) ?? id;
  // Short references instead of ids: less noise for the model, nothing internal leaks.
  const debtRefs = snapshot.debts.map((debt, index) => ({ ref: `D${index + 1}`, debt }));

  return [
    tool({
      name: 'get_month_spending',
      description:
        'Spending of the household by category in one month (YYYY-MM). Available: the current month and the four before it.',
      inputSchema: {
        type: 'object',
        properties: { month: { type: 'string', description: 'Month as YYYY-MM' } },
        required: ['month'],
        additionalProperties: false,
      },
      input: z.object({ month: z.string().regex(MONTH) }),
      async run({ month }) {
        const rows = snapshot.monthlyExpenses.filter((row) => row.month === month);
        const available = [0, -1, -2, -3, -4].map((delta) => monthOf(snapshot.today, delta));
        if (!available.includes(month)) {
          return { content: { error: `Only these months are available: ${available.join(', ')}` } };
        }
        const total = rows.reduce((sum, row) => sum + row.amountMinor, 0);
        return {
          content: {
            month,
            total: money(total),
            byCategory: rows.map((row) => ({
              category: category(row.categoryId),
              spent: money(row.amountMinor),
            })),
          },
        };
      },
    }),
    tool({
      name: 'get_budgets',
      description: 'Budgets of the current month: limit, spent so far and what is left.',
      inputSchema: { type: 'object', properties: {}, required: [], additionalProperties: false },
      input: z.object({}),
      async run() {
        return {
          content: snapshot.budgets.map((budget) => ({
            category: category(budget.categoryId),
            limit: money(budget.limitMinor),
            spent: money(budget.spentMinor),
            left: money(budget.limitMinor - budget.spentMinor),
          })),
        };
      },
    }),
    tool({
      name: 'get_debts',
      description:
        'Debts of the household with their reference (D1, D2…), pending balance, nominal annual rate and monthly payment.',
      inputSchema: { type: 'object', properties: {}, required: [], additionalProperties: false },
      input: z.object({}),
      async run() {
        return {
          content: debtRefs.map(({ ref, debt }) => ({
            ref,
            name: debt.name,
            pending: money(debt.outstandingMinor),
            annualRate: formatRate(debt.annualRateBps),
            monthlyPayment: money(debt.monthlyPaymentMinor),
          })),
        };
      },
    }),
    tool({
      name: 'get_insights',
      description:
        'Savings opportunities found by the deterministic detectors (duplicate subscriptions, exceeded budgets, expensive debts, unusual spending).',
      inputSchema: { type: 'object', properties: {}, required: [], additionalProperties: false },
      input: z.object({}),
      async run() {
        return {
          content: detectAll(snapshot).map((finding) => ({
            kind: finding.kind,
            title: finding.defaultTitle,
            explanation: finding.defaultBody,
            monthlySaving:
              finding.potentialMonthlySavingsMinor === null
                ? null
                : money(finding.potentialMonthlySavingsMinor),
          })),
        };
      },
    }),
    tool({
      name: 'simulate_extra_debt_payment',
      description:
        'Simulates paying an extra amount every month on one debt and shows the user a plan card. extra_monthly_cents is in cents (e.g. 5000 = 50 €).',
      inputSchema: {
        type: 'object',
        properties: {
          debt_ref: { type: 'string', description: 'Reference from get_debts, e.g. D1' },
          extra_monthly_cents: { type: 'integer', description: 'Extra per month, in cents' },
        },
        required: ['debt_ref', 'extra_monthly_cents'],
        additionalProperties: false,
      },
      input: z.object({
        debt_ref: z.string(),
        extra_monthly_cents: z.int().min(100).max(MAX_EXTRA_MINOR),
      }),
      async run({ debt_ref, extra_monthly_cents }) {
        const found = debtRefs.find(({ ref }) => ref === debt_ref.toUpperCase());
        if (!found || found.debt.outstandingMinor <= 0) {
          return { content: { error: `There is no pending debt ${debt_ref}. Call get_debts.` } };
        }
        const { debt } = found;
        let simulation;
        try {
          simulation = simulateExtraPayment(
            {
              principalMinor: debt.outstandingMinor,
              annualRateBps: debt.annualRateBps,
              paymentMinor: debt.monthlyPaymentMinor,
              firstPaymentDate: `${monthOf(snapshot.today, 1)}-01`,
            },
            extra_monthly_cents,
          );
        } catch {
          return { content: { error: 'The monthly payment does not cover the interest.' } };
        }
        const plan: Plan = {
          id: newId(),
          kind: 'debt-payoff',
          title: `Pagar antes «${debt.name}»`,
          summary: `Con ${money(extra_monthly_cents)} más al mes ahorras ${money(simulation.interestSavedMinor)} en intereses y terminas ${simulation.monthsSaved} meses antes.`,
          steps: [
            {
              title: `Añade ${money(extra_monthly_cents)} al mes`,
              detail: `Va directo a reducir lo que debes de «${debt.name}».`,
              action: {
                type: 'extra-debt-payment',
                debtId: debt.id,
                extraMonthlyMinor: extra_monthly_cents,
              },
            },
          ],
          projection: {
            monthlySavingMinor: null,
            interestSavedMinor: simulation.interestSavedMinor,
            debtFreeDate: simulation.withExtra.payoffDate,
          },
          currency: snapshot.currency,
        };
        return {
          content: {
            debt: debt.name,
            extraPerMonth: money(extra_monthly_cents),
            interestSaved: money(simulation.interestSavedMinor),
            monthsSaved: simulation.monthsSaved,
            paidOffOn: simulation.withExtra.payoffDate,
            planShownToUser: true,
          },
          plan,
        };
      },
    }),
    tool({
      name: 'propose_savings_plan',
      description:
        'Builds a savings plan from the detected opportunities and shows it to the user as a card with one-tap actions.',
      inputSchema: { type: 'object', properties: {}, required: [], additionalProperties: false },
      input: z.object({}),
      async run() {
        const findings = detectAll(snapshot).filter(
          (finding) => finding.potentialMonthlySavingsMinor !== null,
        );
        if (findings.length === 0) {
          return { content: { error: 'No savings opportunities were detected right now.' } };
        }
        const total = findings.reduce(
          (sum, finding) => sum + (finding.potentialMonthlySavingsMinor ?? 0),
          0,
        );
        const plan: Plan = {
          id: newId(),
          kind: 'savings',
          title: 'Plan de ahorro',
          summary: `Siguiendo estos pasos podrías ahorrar ${money(total)} al mes.`,
          steps: findings.slice(0, 6).map((finding) => ({
            title: finding.defaultTitle.slice(0, 80),
            detail: finding.defaultBody.slice(0, 300),
            action: finding.actions[0] ?? null,
          })),
          projection: { monthlySavingMinor: total, interestSavedMinor: null, debtFreeDate: null },
          currency: snapshot.currency,
        };
        return {
          content: { monthlySaving: money(total), steps: plan.steps.length, planShownToUser: true },
          plan,
        };
      },
    }),
  ];
}

/** The household as a short text for the model: totals only, no movements or names of people. */
export function describeHousehold(snapshot: HouseholdSnapshot): string {
  const money = (minor: number) => formatMoney(minor, snapshot.currency);
  const month = monthOf(snapshot.today);
  const thisMonth = snapshot.monthlyExpenses.filter((row) => row.month === month);
  const total = thisMonth.reduce((sum, row) => sum + row.amountMinor, 0);
  return [
    `Today is ${snapshot.today}. Currency: ${snapshot.currency}.`,
    `Spending so far this month (${month}): ${money(total)}.`,
    `Budgets this month: ${snapshot.budgets.length}. Debts: ${snapshot.debts.length}. Active recurring payments: ${snapshot.recurring.length}.`,
    'Use the tools for details; every figure you mention must come from them.',
  ].join('\n');
}
