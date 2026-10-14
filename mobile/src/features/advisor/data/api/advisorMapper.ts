import type {
  AdvisorAction as AdvisorActionDto,
  ChatStreamEvent,
  InsightsReportDto,
  MoneyDto,
  PlanDto,
  ProblemDetails,
} from '@icount/contracts';

import type { CategoryId } from '@/core/domain/Category';
import { Money } from '@/core/domain/Money';

import { fromLocalDate } from '../../../transactions/data/api/transactionMapper';
import type { AdvisorAction, ChatEvent, InsightsReport, Plan } from '../../domain/Advisor';

const toMoney = (money: MoneyDto) => Money.ofMinor(money.amountMinor, money.currency);
const fromMoney = (money: Money): MoneyDto => ({
  amountMinor: money.amountMinor,
  currency: money.currency,
});

export function toAction(dto: AdvisorActionDto): AdvisorAction {
  switch (dto.type) {
    case 'set-budget': {
      const [year, month] = dto.month.split('-').map(Number) as [number, number];
      return {
        type: 'set-budget',
        categoryId: dto.categoryId as CategoryId,
        month: { year, month },
        limit: toMoney(dto.limit),
      };
    }
    case 'extra-debt-payment':
      return {
        type: 'extra-debt-payment',
        debtId: dto.debtId,
        extraMonthly: toMoney(dto.extraMonthly),
      };
    case 'cancel-recurring':
      return { type: 'cancel-recurring', recurringPaymentId: dto.recurringPaymentId };
  }
}

export function toActionDto(action: AdvisorAction) {
  switch (action.type) {
    case 'set-budget':
      return {
        type: 'set-budget' as const,
        categoryId: action.categoryId,
        month: `${action.month.year}-${String(action.month.month).padStart(2, '0')}`,
        limit: fromMoney(action.limit),
      };
    case 'extra-debt-payment':
      return {
        type: 'extra-debt-payment' as const,
        debtId: action.debtId,
        extraMonthly: fromMoney(action.extraMonthly),
      };
    case 'cancel-recurring':
      return { type: 'cancel-recurring' as const, recurringPaymentId: action.recurringPaymentId };
  }
}

export function toInsightsReport(dto: InsightsReportDto): InsightsReport {
  return {
    generatedAt: new Date(dto.generatedAt),
    totalPotentialMonthlySavings: toMoney(dto.totalPotentialMonthlySavings),
    insights: dto.insights.map((insight) => ({
      id: insight.id,
      kind: insight.kind,
      priority: insight.priority,
      title: insight.title,
      body: insight.body,
      potentialMonthlySavings:
        insight.potentialMonthlySavings && toMoney(insight.potentialMonthlySavings),
      evidence: insight.evidence.map((evidence) => ({
        label: evidence.label,
        amount: toMoney(evidence.amount),
      })),
      actions: insight.actions.map(toAction),
    })),
  };
}

export function toPlan(dto: PlanDto): Plan {
  return {
    id: dto.id,
    kind: dto.kind,
    title: dto.title,
    summary: dto.summary,
    steps: dto.steps.map((step) => ({
      title: step.title,
      detail: step.detail,
      action: step.action && toAction(step.action),
    })),
    projection: {
      monthlySaving: dto.projection.monthlySaving && toMoney(dto.projection.monthlySaving),
      interestSaved: dto.projection.interestSaved && toMoney(dto.projection.interestSaved),
      debtFreeDate:
        dto.projection.debtFreeDate === null ? null : fromLocalDate(dto.projection.debtFreeDate),
    },
  };
}

/** A problem as a short text for the chat bubble. */
export function problemMessage(problem: ProblemDetails | null): string {
  return problem?.detail ?? problem?.title ?? 'No se pudo contactar con el asistente.';
}

export function toChatEvent(event: ChatStreamEvent): ChatEvent {
  switch (event.type) {
    case 'delta':
      return event;
    case 'plan':
      return { type: 'plan', plan: toPlan(event.plan) };
    case 'done':
      return event;
    case 'error':
      return { type: 'error', message: problemMessage(event.problem) };
  }
}
