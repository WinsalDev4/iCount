import { describe, expect, it } from 'vitest';

import {
  advisorActionSchema,
  chatRequestSchema,
  chatStreamEventSchema,
  insightDtoSchema,
  planDtoSchema,
} from '../index.ts';

const eur = (amountMinor: number) => ({ amountMinor, currency: 'EUR' });
const debt = '0199e0a4-5b2c-7c3d-9e4f-0000000000f1';
const uuid = '0199e0a4-5b2c-7c3d-9e4f-0000000000aa';

describe('advisor actions', () => {
  it.each([
    { type: 'set-budget', categoryId: 'leisure', month: '2026-11', limit: eur(15_000) },
    { type: 'extra-debt-payment', debtId: debt, extraMonthly: eur(10_000) },
    { type: 'cancel-recurring', recurringPaymentId: uuid },
  ])('accept %j', (action) => {
    expect(advisorActionSchema.parse(action)).toEqual(action);
  });

  it('reject unknown action types and invalid amounts', () => {
    expect(advisorActionSchema.safeParse({ type: 'transfer-money' }).success).toBe(false);
    expect(
      advisorActionSchema.safeParse({
        type: 'extra-debt-payment',
        debtId: debt,
        extraMonthly: eur(0),
      }).success,
    ).toBe(false);
  });
});

describe('insights and plans', () => {
  it('read unknown insight kinds as other', () => {
    const insight = {
      id: uuid,
      kind: 'tax-refund',
      priority: 2,
      title: 'Algo nuevo',
      body: 'Detalle',
      potentialMonthlySavings: null,
      evidence: [],
      actions: [],
    };
    expect(insightDtoSchema.parse(insight).kind).toBe('other');
  });

  it('require at least one step in a plan', () => {
    const plan = {
      id: uuid,
      kind: 'debt-payoff',
      title: 'Liquidar el coche antes',
      summary: '+100 €/mes',
      steps: [],
      projection: { monthlySaving: null, interestSaved: eur(18_000), debtFreeDate: '2028-02-05' },
    };
    expect(planDtoSchema.safeParse(plan).success).toBe(false);
    expect(
      planDtoSchema.safeParse({
        ...plan,
        steps: [{ title: 'Paga 100 € extra', detail: '', action: null }],
      }).success,
    ).toBe(true);
  });
});

describe('chat', () => {
  it('trims messages and limits their length', () => {
    expect(chatRequestSchema.parse({ message: '  ¿Cuánto gasto en ocio? ' }).message).toBe(
      '¿Cuánto gasto en ocio?',
    );
    expect(chatRequestSchema.safeParse({ message: 'x'.repeat(2_001) }).success).toBe(false);
  });

  it('parse every stream event type', () => {
    expect(chatStreamEventSchema.parse({ type: 'delta', text: 'Hola' }).type).toBe('delta');
    expect(
      chatStreamEventSchema.parse({
        type: 'done',
        conversationId: uuid,
        messageId: uuid,
        remainingMessagesToday: 19,
      }).type,
    ).toBe('done');
    expect(
      chatStreamEventSchema.parse({ type: 'error', problem: { status: 429, title: 'Cuota' } }).type,
    ).toBe('error');
  });
});
