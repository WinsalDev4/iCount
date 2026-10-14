import {
  type AdvisorAction as AdvisorActionDto,
  advisorActionSchema,
  type InsightsReportDto,
  insightsReportDtoSchema,
  type PlanDto,
  planDtoSchema,
} from '@icount/contracts';

import type { InsightsReport, Plan } from '../../domain/advisor.js';
import type { AdvisorAction } from '../../domain/findings.js';

const money = (amountMinor: number, currency: string) => ({ amountMinor, currency });

export function toActionDto(action: AdvisorAction, currency: string): AdvisorActionDto {
  switch (action.type) {
    case 'set-budget':
      return advisorActionSchema.parse({
        type: 'set-budget',
        categoryId: action.categoryId,
        month: action.month,
        limit: money(action.limitMinor, currency),
      });
    case 'extra-debt-payment':
      return advisorActionSchema.parse({
        type: 'extra-debt-payment',
        debtId: action.debtId,
        extraMonthly: money(action.extraMonthlyMinor, currency),
      });
    case 'cancel-recurring':
      return advisorActionSchema.parse(action);
  }
}

/** Contract action → domain action (amounts must be in the household currency). */
export function fromActionDto(action: AdvisorActionDto): AdvisorAction {
  switch (action.type) {
    case 'set-budget':
      return {
        type: 'set-budget',
        categoryId: action.categoryId,
        month: action.month,
        limitMinor: action.limit.amountMinor,
      };
    case 'extra-debt-payment':
      return {
        type: 'extra-debt-payment',
        debtId: action.debtId,
        extraMonthlyMinor: action.extraMonthly.amountMinor,
      };
    case 'cancel-recurring':
      return { type: 'cancel-recurring', recurringPaymentId: action.recurringPaymentId };
  }
}

export function toInsightsReportDto(report: InsightsReport): InsightsReportDto {
  const { currency } = report;
  const total = report.insights.reduce(
    (sum, insight) => sum + (insight.potentialMonthlySavingsMinor ?? 0),
    0,
  );
  return insightsReportDtoSchema.parse({
    generatedAt: report.generatedAt.toISOString(),
    totalPotentialMonthlySavings: money(total, currency),
    insights: report.insights.map((insight) => ({
      id: insight.id,
      kind: insight.kind,
      priority: insight.priority,
      title: insight.title,
      body: insight.body,
      potentialMonthlySavings:
        insight.potentialMonthlySavingsMinor === null
          ? null
          : money(insight.potentialMonthlySavingsMinor, currency),
      evidence: insight.evidence.map((evidence) => ({
        label: evidence.label.slice(0, 60),
        amount: money(evidence.amountMinor, currency),
      })),
      actions: insight.actions.map((action) => toActionDto(action, currency)),
    })),
  });
}

export function toPlanDto(plan: Plan): PlanDto {
  const { currency, projection } = plan;
  return planDtoSchema.parse({
    id: plan.id,
    kind: plan.kind,
    title: plan.title.slice(0, 80),
    summary: plan.summary.slice(0, 400),
    steps: plan.steps.map((step) => ({
      title: step.title.slice(0, 80),
      detail: step.detail.slice(0, 300),
      action: step.action && toActionDto(step.action, currency),
    })),
    projection: {
      monthlySaving:
        projection.monthlySavingMinor === null
          ? null
          : money(projection.monthlySavingMinor, currency),
      interestSaved:
        projection.interestSavedMinor === null
          ? null
          : money(projection.interestSavedMinor, currency),
      debtFreeDate: projection.debtFreeDate,
    },
  });
}
